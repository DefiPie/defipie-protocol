pragma solidity ^0.7.4;

interface IController {
	function refreshPieSpeeds() external;
}

contract RefreshSpeedsProxy {
	constructor(address controller) {
		IController(controller).refreshPieSpeeds();
	}
}
