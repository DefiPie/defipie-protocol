// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./VotingEscrowImports/SafeERC20.sol";
import "./VotingEscrowImports/IERC20Metadata.sol";
import "./VotingEscrowImports/ReentrancyGuard.sol";
import "./VotingEscrowImports/IVotingEscrow.sol";
import "./VotingEscrowImports/Integers.sol";
import "./VotingEscrowStorage.sol";
import "../Tokens/PTokenInterfaces.sol";

/**
 * @title Voting Escrow
 * @notice Votes have a weight depending on time, so that users are
 *         committed to the future of (whatever they are voting for)
 * @dev Vote weight decays linearly over time. Lock time cannot be
 *      more than `MAXTIME`.
 */

// Voting escrow to have time-weighted votes
// Votes have a weight depending on time, so that users are committed
// to the future of (whatever they are voting for).
// The weight in this implementation is linear, and lock cannot be more than maxtime:
// w ^
// 1 +        /
//   |      /
//   |    /
//   |  /
//   |/
// 0 +--------+------> time
//       maxtime

contract VotingEscrow is VotingEscrowStorageV1, ReentrancyGuard, IVotingEscrow {
    using SafeERC20 for IERC20;
    using Integers for int128;
    using Integers for uint;

    function initialize(
        RegistryInterface _registry,
        address _token,
        string memory _name,
        string memory _symbol,
        uint _interval,
        uint _minDuration,
        uint _maxDuration,
        uint _minLockAmount,
        address _governor
    ) public {
        require(registry == RegistryInterface(address(0)), "VE: only once");

        registry = _registry;
        token = _token;
        name = _name;
        symbol = _symbol;
        decimals = IERC20Metadata(_token).decimals();

        interval = _interval;
        minDuration = (_minDuration / _interval) * _interval; // rounded down to a multiple of interval
        maxDuration = (_maxDuration / _interval) * _interval; // rounded down to a multiple of interval

        pointHistory[0].blk = block.number;
        pointHistory[0].ts = block.timestamp;

        minLockAmount = _minLockAmount;

        governor = Governor(_governor);

        emit NewMinLockAmount(0, _minLockAmount);
        emit NewMinDuration(0, minDuration);
        emit NewMaxDuration(0, maxDuration);
    }

    /**
     * @notice Get the delegate length for user
     * @param user User wallet address
     * @return Value of the delegate length
     */
    function delegateLength(address user) external view returns (uint) {
        return delegateAt[user].length;
    }

    /**
     * @notice Get the most recently recorded rate of voting power decrease for user
     * @param user User wallet address
     * @return Value of the slope
     */
    function getLastUserSlope(address user) external view override returns (int128) {
        uint uepoch = userPointEpoch[user];

        return userPointHistory[user][uepoch].slope;
    }

    /**
     * @notice Get the timestamp for checkpoint `id` for user
     * @param user User wallet address
     * @param id User epoch number
     * @return Epoch time of the checkpoint
     */
    function getCheckpointTime(address user, uint id) external view override returns (uint) {
        return userPointHistory[user][id].ts;
    }

    /**
     * @notice Get timestamp when user's lock finishes
     * @param user User wallet address
     * @return Epoch time of the lock end
     */
    function getUnlockTime(address user) external view override returns (uint) {
        return locked[user].end;
    }

    /**
     * @notice Get timestamp when user's lock starts
     * @param user User wallet address
     * @return Epoch time of the lock start
     */
    function getStartTime(address user) external view override returns (uint) {
        return locked[user].start;
    }

    /**
     * @notice Get amount user's lock
     * @param user User wallet address
     * @return Amount of lock
     */
    function getAmount(address user) external view override returns (int128) {
        return locked[user].amount;
    }

    /**
     * @notice Record global and per-user data to checkpoint
     * @param user User's wallet address. No user checkpoint if 0x0
     * @param old_locked Previous locked amount / end lock time for the user
     * @param new_locked New locked amount / end lock time for the user
     */
    function _checkpoint(
        address user,
        LockedBalance memory old_locked,
        LockedBalance memory new_locked
    ) internal {
        Point memory u_old;
        Point memory u_new;
        int128 old_dslope;
        int128 new_dslope;
        uint _epoch = epoch;

        if (user != address(0)) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / maxDuration.toInt128();
                u_old.bias = u_old.slope * (old_locked.end - block.timestamp).toInt128();
            }
            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / maxDuration.toInt128();
                u_new.bias = u_new.slope * (new_locked.end - block.timestamp).toInt128();
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = slopeChanges[old_locked.end];
            if (new_locked.end != 0) {
                if (new_locked.end == old_locked.end) {
                    new_dslope = old_dslope;
                } else {
                    new_dslope = slopeChanges[new_locked.end];
                }
            }
        }

        Point memory last_point = Point({bias: 0, slope: 0, ts: block.timestamp, blk: block.number});
        if (_epoch > 0) {
            last_point = pointHistory[_epoch];
        }
        uint last_checkpoint = last_point.ts;

        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initial_last_point = Point(last_point.bias, last_point.slope, last_point.ts, last_point.blk);
        uint block_slope; // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope = (MULTIPLIER * (block.number - last_point.blk)) / (block.timestamp - last_point.ts);
        }

        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case
        {
            // Go over weeks to fill history and calculate what the current point is
            uint t_i = (last_checkpoint / interval) * interval;
            for(uint i = 0; i < 255; i++) {
                // Hopefully it won't happen that this won't get used in 5 years!
                // If it does, users will be able to withdraw but vote weight will be broken
                t_i += interval;
                int128 d_slope;
                if (t_i > block.timestamp) {
                    t_i = block.timestamp;
                } else {
                    d_slope = slopeChanges[t_i];
                }
                last_point.bias -= last_point.slope * (t_i - last_checkpoint).toInt128();
                last_point.slope += d_slope;
                if (last_point.bias < 0) {
                    // This can happen
                    last_point.bias = 0;
                }

                if (last_point.slope < 0) {
                    // This cannot happen - just in case
                    last_point.slope = 0;
                }

                last_checkpoint = t_i;
                last_point.ts = t_i;
                last_point.blk = initial_last_point.blk + (block_slope * (t_i - initial_last_point.ts)) / MULTIPLIER;
                _epoch += 1;
                if (t_i == block.timestamp) {
                    last_point.blk = block.number;
                    break;
                } else {
                    pointHistory[_epoch] = last_point;
                }
            }
        }

        epoch = _epoch;

        // Now point_history is filled until t=now
        if (user != address(0)) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }

        // Record the changed point into history
        pointHistory[_epoch] = last_point;

        if (user != address(0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;
                if (new_locked.end == old_locked.end) {
                    old_dslope -= u_new.slope; // It was a new deposit, not extension
                }
                slopeChanges[old_locked.end] = old_dslope;
            }

            if (new_locked.end > block.timestamp) {
                if (new_locked.end > old_locked.end) {
                    new_dslope -= u_new.slope; // old slope disappeared at this point
                    slopeChanges[new_locked.end] = new_dslope;
                }
                // else: we recorded it already in old_dslope
            }

            // Now handle user history
            uint user_epoch = userPointEpoch[user] + 1;

            userPointEpoch[user] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            userPointHistory[user][user_epoch] = u_new;
        }
    }

    /**
     * @notice Deposit and lock tokens for a user
     * @param user User's wallet address
     * @param amount Amount to deposit
     * @param unlock_time New time when to unlock the tokens, or 0 if unchanged
     * @param locked_balance Previous locked amount / timestamp
     */
    function _depositFor(
        address user,
        uint amount,
        uint unlock_time,
        LockedBalance memory locked_balance,
        int128 depositType
    ) internal {
        LockedBalance memory _locked = locked_balance;
        uint supply_before = supply;

        supply = supply_before + amount;
        LockedBalance memory old_locked;
        (old_locked.amount, old_locked.start, old_locked.end) = (
            _locked.amount,
            _locked.start,
            _locked.end
        );
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += (amount).toInt128();
        if (unlock_time != 0) {
            if (_locked.start == 0) {
                _locked.start = block.timestamp;
            }
            _locked.end = unlock_time;
        }
        locked[user] = _locked;

        // Possibilities:
        // Both old_locked.end could be current or expired (>/< block.timestamp)
        // value == 0 (extend lock) or value > 0 (add to lock or extend lock)
        // _locked.end > block.timestamp (always)
        _checkpoint(user, old_locked, _locked);

        if (amount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            IERC20(token).approve(registry.pPIE(), amount);
            PErc20Interface(registry.pPIE()).mint(amount);
        }

        emit Deposit(user, amount, _locked.end, depositType, block.timestamp);
        emit Supply(supply_before, supply_before + amount);
    }

    /**
     * @notice First delegate for 'msg.sender' to user
     * @param user User's address
     */
    function delegate(address user) external {
        require(delegateOf[msg.sender] == address(0), "VE: Old delegator found");
        require(user != address(0), "VE: delegatee must not be zero address");
        delegateOf[msg.sender] = user;

        _pushDelegate(user, msg.sender);
    }

    /**
     * @notice Change delegator for 'msg.sender' to user
     * @param user User's address
     */
    function changeDelegator(address user) external {
        require(delegateOf[msg.sender] != address(0), "VE: Old delegator is not found");
        require(user != address(0), "VE: delegatee must not be zero address");

        _popDelegate(delegateOf[msg.sender], msg.sender);
        _pushDelegate(user, msg.sender);

        delegateOf[msg.sender] = user;
    }

    /**
     * @notice Remove delegator for 'msg.sender'
     */
    function removeDelegator() external {
        require(delegateOf[msg.sender] != address(0), "VE: Old delegator is not found");

        _popDelegate(delegateOf[msg.sender], msg.sender);

        delegateOf[msg.sender] = address(0);
    }

    /**
     * @notice Add the delegate for user
     * @param user User address
     * @param _delegate Delegate address
     */
    function _pushDelegate(address user, address _delegate) internal {
        bool found;
        address[] storage delegates = delegateAt[user];
        for (uint i = 0; i < delegates.length; ) {
            if (delegates[i] == _delegate) {
                found = true;
            }
            unchecked {
                ++i;
            }
        }
        if (!found) {
            delegateAt[user].push(_delegate);
        }
    }

    /**
     * @notice Remove the delegate for user
     * @param user User address
     * @param _delegate Delegate address
     */
    function _popDelegate(address user, address _delegate) internal {
        address[] storage delegates = delegateAt[user];

        uint lastId = delegates.length - 1;
        address lastDelegate = delegates[lastId];

        for (uint i = 0; i < delegates.length; ) {
            if (delegates[i] == _delegate) {
                delegates[i] = lastDelegate;
                break;
            }
            unchecked {
                ++i;
            }
        }

        delegates.pop();
    }

    /**
     * @notice Deposit `amount` tokens for user and add to the lock
     * @dev Anyone (even a smart contract) can deposit for someone else, but
     *      cannot extend their locktime and deposit for a brand new user
     * @param user User's wallet address
     * @param amount Amount to add to user's lock
     */
    function depositFor(address user, uint amount) external override nonReentrant {
        require(amount > minLockAmount, "VE: INVALID_VALUE");

        LockedBalance memory _locked = locked[user];
        require(_locked.amount > 0, "VE: LOCK_NOT_FOUND");
        require(_locked.end > block.timestamp, "VE: LOCK_EXPIRED");

        _depositFor(user, amount, 0, _locked, DEPOSIT_FOR_TYPE);
    }

    /**
     * @notice Deposit `amount` tokens for `msg.sender` and lock for `_duration`
     * @param amount Amount to deposit
     * @param duration Epoch time until tokens unlock from now
     */
    function createLock(uint amount, uint duration)
        external
        override
        nonReentrant
    {
        createLockForInternal(msg.sender, amount, duration);
    }

    /**
     * @notice Deposit `_value` tokens for user and lock for `_duration`
     * @dev Only delegates can creat a lock for someone else
     * @param user User's wallet address
     * @param amount Amount to add to user's lock
     * @param duration Epoch time until tokens unlock from now
     */
    function createLockFor(
        address user,
        uint amount,
        uint duration
    ) external override nonReentrant {
        createLockForInternal(user, amount, duration);
    }

    /**
     * @notice Check msg.sender (contract or not) and check in whitelist
     */
    function assertNotContract() internal view {
        if (msg.sender != tx.origin) {
            if (getWhiteListStatus(msg.sender)) {
                return;
            }

            revert("Smart contract depositors not allowed");
        }
    }

    function createLockForInternal(
        address user,
        uint amount,
        uint duration
    ) internal {
        assertNotContract();
        require(amount > minLockAmount, "VE: INVALID_VALUE");

        uint unlock_time = ((block.timestamp + duration) / interval) * interval; // Locktime is rounded down to a multiple of interval
        require(unlock_time >= block.timestamp + minDuration, "VE: UNLOCK_TIME_TOO_EARLY");
        require(unlock_time <= block.timestamp + maxDuration, "VE: UNLOCK_TIME_TOO_LATE");

        LockedBalance memory _locked = locked[user];
        require(_locked.amount == 0, "VE: EXISTING_LOCK_FOUND");

        _depositFor(user, amount, unlock_time, _locked, CREATE_LOCK_TYPE);
    }

    /**
     * @notice Deposit `amount` additional tokens for `msg.sender`
     *          without modifying the unlock time
     * @param user User's wallet address
     * @param amount Amount of tokens to deposit and add to the lock
     */
    function increaseAmountFor(
        address user,
        uint amount
    ) external override nonReentrant {
        increaseAmountInternal(user, amount);
    }

    /**
     * @notice Deposit `amount` additional tokens for `msg.sender`
     *          without modifying the unlock time
     * @param amount Amount of tokens to deposit and add to the lock
     */
    function increaseAmount(uint amount) external override nonReentrant {
        increaseAmountInternal(msg.sender, amount);
    }

    function increaseAmountInternal(address user, uint amount) internal {
        require(amount > 0, "VE: INVALID_VALUE");

        LockedBalance memory _locked = locked[msg.sender];
        require(_locked.amount > 0, "VE: LOCK_NOT_FOUND");
        require(_locked.end > block.timestamp, "VE: LOCK_EXPIRED");

        _depositFor(user, amount, 0, _locked, INCREASE_LOCK_AMOUNT);
    }

    /**
     * @notice Extend the unlock time for `msg.sender` to `duration`
     * @param duration Increased epoch time for unlocking
     */
    function increaseUnlockTime(uint duration)
        external
        override
        nonReentrant
    {
        LockedBalance memory _locked = locked[msg.sender];
        require(_locked.amount > 0, "VE: LOCK_NOT_FOUND");
        require(_locked.end > block.timestamp, "VE: LOCK_EXPIRED");

        uint unlock_time = ((_locked.end + duration) / interval) * interval; // Locktime is rounded down to a multiple of interval
        require(unlock_time >= _locked.end + interval, "VE: UNLOCK_TIME_TOO_EARLY");
        require(unlock_time <= block.timestamp + maxDuration, "VE: UNLOCK_TIME_TOO_LATE");

        _depositFor(msg.sender, 0, unlock_time, _locked, INCREASE_UNLOCK_TIME);
    }

    /**
     * @notice Withdraw all tokens for `msg.sender`
     * @dev Only possible if the lock has expired
     */
    function withdraw() external override nonReentrant {
        LockedBalance memory _locked = locked[msg.sender];
        require(block.timestamp >= _locked.end, "VE: LOCK_NOT_EXPIRED");

        uint supply_before = _clear(_locked);

        uint amount = _locked.amount.toUint256();

        if (amount > 0) {
            uint ppieAmount = PTokenInterface(registry.pPIE()).balanceOfUnderlying(address(this)) * amount / supply_before;
            IERC20(registry.pPIE()).safeTransfer(msg.sender, ppieAmount);
        }

        emit Withdraw(msg.sender, amount, block.timestamp);
        emit Supply(supply_before, supply_before - amount);
    }

    function _clear(LockedBalance memory _locked) internal returns (uint) {
        uint amount = _locked.amount.toUint256();

        locked[msg.sender] = LockedBalance(0, 0, 0);
        uint supply_before = supply;
        supply = supply_before - amount;

        // old_locked can have either expired <= timestamp or zero end
        // _locked has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, _locked, LockedBalance(0, 0, 0));

        delete delegateAt[msg.sender];

        return supply_before;
    }

    // The following ERC20/min-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.

    /**
     * @notice Binary search to estimate timestamp for block number
     * @param blockNumber Block to find
     * @param max_epoch Don't go beyond this epoch
     * @return Approximate timestamp for block
     */
    function _findBlockEpoch(uint blockNumber, uint max_epoch) internal view returns (uint) {
        uint _min;
        uint _max = max_epoch;
        for (uint i = 0; i < 128; i++) {
            if (_min >= _max) {
                break;
            }
            uint _mid = (_min + _max + 1) / 2;
            if (pointHistory[_mid].blk <= blockNumber) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }

        return _min;
    }

    function balanceOf(address user) public view override returns (uint) {
        return balanceOf(user, block.timestamp);
    }

    /**
     * @notice Get the current voting power for `msg.sender`
     * @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
     * @param user User wallet address
     * @param _t Epoch time to return voting power at
     * @return User voting power
     */
    function balanceOf(address user, uint _t) public view override returns (uint) {
        uint _epoch = userPointEpoch[user];
        if (_epoch == 0) {
            return 0;
        } else {
            Point memory last_point = userPointHistory[user][_epoch];
            last_point.bias -= last_point.slope * (_t - last_point.ts).toInt128();
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }

            return last_point.bias.toUint256();
        }
    }

    /**
     * @notice Measure voting power of user at block height `_block`
     * @dev Adheres to MiniMe `balanceOfAt` interface: https://github.com/Giveth/minime
     * @param user User's wallet address
     * @param blockNumber Block to calculate the voting power at
     * @return Voting power
     */
    function balanceOfAt(address user, uint blockNumber) external view override returns (uint) {
        require(blockNumber <= block.number, "VE: INVALID_VALUE");

        return balanceOfAtInternal(user, blockNumber);
    }

    function balanceOfAtInternal(address user, uint blockNumber) internal view returns (uint) {
        // Binary search
        uint _min;
        uint _max = userPointEpoch[user];
        for (uint i = 0; i < 128; i++) {
            if (_min >= _max) {
                break;
            }
            uint _mid = (_min + _max + 1) / 2;
            if (userPointHistory[user][_mid].blk <= blockNumber) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }

        Point memory upoint = userPointHistory[user][_min];

        uint max_epoch = epoch;
        uint _epoch = _findBlockEpoch(blockNumber, max_epoch);
        Point memory point_0 = pointHistory[_epoch];
        uint d_block;
        uint d_t;
        if (_epoch < max_epoch) {
            Point memory point_1 = pointHistory[_epoch + 1];
            d_block = point_1.blk - point_0.blk;
            d_t = point_1.ts - point_0.ts;
        } else {
            d_block = block.number - point_0.blk;
            d_t = block.timestamp - point_0.ts;
        }
        uint block_time = point_0.ts;
        if (d_block != 0) {
            block_time += ((d_t * (blockNumber - point_0.blk)) / d_block);
        }

        upoint.bias -= upoint.slope * (block_time - upoint.ts).toInt128();
        if (upoint.bias >= 0) {
            return upoint.bias.toUint256();
        } else {
            return 0;
        }
    }

    /**
     * @notice Calculate total voting power at some point in the past
     * @param point The point (bias/slope) to start search from
     * @param t Time to calculate the total voting power at
     * @return Total voting power at that time
     */
    function _supplyAt(Point memory point, uint t) internal view returns (uint) {
        Point memory last_point = point;
        uint t_i = (last_point.ts / interval) * interval;
        for (uint i = 0; i < 255; i++) {
            t_i += interval;
            int128 d_slope;
            if (t_i > t) {
                t_i = t;
            } else {
                d_slope = slopeChanges[t_i];
            }
            last_point.bias -= last_point.slope * (t_i - last_point.ts).toInt128();
            if (t_i == t) {
                break;
            }
            last_point.slope += d_slope;
            last_point.ts = t_i;
        }

        if (last_point.bias < 0) {
            last_point.bias = 0;
        }

        return last_point.bias.toUint256();
    }

    function totalSupply() public view override returns (uint) {
        return totalSupply(block.timestamp);
    }

    /**
     * @notice Calculate total voting power
     * @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
     * @return Total voting power
     */
    function totalSupply(uint t) public view override returns (uint) {
        Point memory last_point = pointHistory[epoch];

        return _supplyAt(last_point, t);
    }

    /**
     * @notice Calculate total voting power at some point in the past
     * @param blockNumber Block to calculate the total voting power at
     * @return Total voting power at `_block`
     */
    function totalSupplyAt(uint blockNumber) external view override returns (uint) {
        require(blockNumber <= block.number, "VE: INVALID_VALUE");

        uint _epoch = epoch;
        uint target_epoch = _findBlockEpoch(blockNumber, _epoch);

        Point memory point = pointHistory[target_epoch];
        uint dt;
        if (target_epoch < _epoch) {
            Point memory point_next = pointHistory[target_epoch + 1];
            if (point.blk != point_next.blk) {
                dt = ((blockNumber - point.blk) * (point_next.ts - point.ts)) / (point_next.blk - point.blk);
            }
        } else if (point.blk != block.number) {
            dt = ((blockNumber - point.blk) * (block.timestamp - point.ts)) / (block.number - point.blk);
        }

        // Now dt contains info on how far are we beyond point
        return _supplyAt(point, point.ts + dt);
    }

    /**
     * @notice Determine the prior number of votes for an user as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param user The address of the user to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address user, uint blockNumber) external view returns (uint) {
        require(blockNumber < block.number, "VE: INVALID_VALUE");


        uint votesAmount = 0;
        if(delegateOf[user] == address(0)) {
            votesAmount = balanceOfAtInternal(user, blockNumber);
        }

        for(uint i = 0; i < delegateAt[user].length;) {
            votesAmount += balanceOfAtInternal(delegateAt[user][i], blockNumber);

            unchecked {
                ++i;
            }
        }

        return votesAmount;
    }

    /**
     * @notice Set max duration (admin only)
     * @param newMaxDuration New max duration in sec (rounded down to a multiple of interval)
     */
    function setMaxDuration(uint newMaxDuration) external {
        require(msg.sender == getAdmin(), "VE: Only admin");
        require(newMaxDuration >= minDuration, "VE: Cannot be less than min time");
        require(newMaxDuration <= maxDuration, "VE: Cannot exceed max time");
        
        uint oldMaxDuration = maxDuration;
        maxDuration = (newMaxDuration / interval) * interval;

        emit NewMaxDuration(oldMaxDuration, maxDuration);
    }

    /**
     * @notice Set min duration (admin only)
     * @param newMinDuration New max duration in sec (rounded down to a multiple of interval)
     */
    function setMinDuration(uint newMinDuration) external {
        require(msg.sender == getAdmin(), "VE: Only admin");

        uint oldMinDuration = minDuration;
        minDuration = (newMinDuration / interval) * interval;

        emit NewMinDuration(oldMinDuration, minDuration);
    }

    /**
     * @notice Set min lock amount for users (admin only)
     * @param newMinLockAmount Min token amount for create lock
     */
    function setMinLockAmount(uint newMinLockAmount) external {
        require(msg.sender == getAdmin(), "VE: Only admin");

        uint oldMinLockAmount = minLockAmount;
        minLockAmount = newMinLockAmount;

        emit NewMinLockAmount(oldMinLockAmount, newMinLockAmount);
    }

    /**
     * @notice Get admin address from registry
     * @return Admin address from registry
     */
    function getAdmin() public view virtual returns (address) {
        return registry.admin();
    }

    /**
     * @notice Add address to whitelist
     * @param account Address (user or contract)
     */
    function addWhiteList(address account) public {
        require(msg.sender == getAdmin() || msg.sender == governor.guardian(), "VE: Only admin or governance guardian");

        isWhiteListed[account] = true;

        emit AddedWhiteList(account);
    }

    /**
     * @notice Remove address from whitelist
     * @param account Address (user or contract)
     */
    function removeWhiteList(address account) public {
        require(msg.sender == getAdmin() || msg.sender == governor.guardian(), "VE: Only admin or governance guardian");

        isWhiteListed[account] = false;

        emit RemovedWhiteList(account);
    }

    /**
     * @notice Check whitelist for address
     * @param account Account address (user or contract)
     * @return Bool Result (true or false)
     */
    function getWhiteListStatus(address account) public view returns (bool) {
        return isWhiteListed[account];
    }

    function getDelegators(address user) public view returns (address[] memory) {
        return delegateAt[user];
    }

    function getDelegate(address delegator) public view returns (address) {
        return delegateOf[delegator];
    }
}