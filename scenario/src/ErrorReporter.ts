import {ControllerErr, DistributorErr, TokenErr, OracleErr, FactoryErr, RegistryErr} from './ErrorReporterConstants';

export interface ErrorReporter {
  getError(error: any): string | null
  getInfo(info: any): string | null
  getDetail(error: any, detail: number): string
}

class NoErrorReporterType implements ErrorReporter {
  getError(error: any): string | null {
    return null;
  }

  getInfo(info: any): string | null {
    return null;
  }

  getDetail(error: any, detail: number): string {
    return detail.toString();
  }
}

class PTokenErrorReporterType implements ErrorReporter {
  getError(error: any): string | null {
    if (error === null) {
      return null;
    } else {
      return TokenErr.ErrorInv[Number(error)];
    }
  }

  getInfo(info: any): string | null {
    if (info === null) {
      return null;
    } else {
      return TokenErr.FailureInfoInv[Number(info)];
    }
  }

  getDetail(error: any, detail: number): string {
    // Little hack to let us use proper names for cross-contract errors
    if (this.getError(error) === "CONTROLLER_REJECTION") {
      let controllerError = ControllerErrorReporter.getError(detail);

      if (controllerError) {
        return controllerError;
      }
    }

    return detail.toString();
  }
}

class ControllerErrorReporterType implements ErrorReporter {
  getError(error: any): string | null {
    if (error === null) {
      return null;
    } else {
      // TODO: This probably isn't right...
      return ControllerErr.ErrorInv[Number(error)];
    }
  }

  getInfo(info: any): string | null {
    if (info === null) {
      return null;
    } else {
      // TODO: This probably isn't right...
      return ControllerErr.FailureInfoInv[Number(info)];
    }
  }

  getDetail(error: any, detail: number): string {
    if (this.getError(error) === "REJECTION") {
      let controllerError = ControllerErrorReporter.getError(detail);

      if (controllerError) {
        return controllerError;
      }
    }

    return detail.toString();
  }
}

class DistributorErrorReporterType implements ErrorReporter {
    getError(error: any): string | null {
        if (error === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return DistributorErr.ErrorInv[Number(error)];
        }
    }

    getInfo(info: any): string | null {
        if (info === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return DistributorErr.FailureInfoInv[Number(info)];
        }
    }

    getDetail(error: any, detail: number): string {
        if (this.getError(error) === "REJECTION") {
            let distributorError = DistributorErrorReporter.getError(detail);

            if (distributorError) {
                return distributorError;
            }
        }

        return detail.toString();
    }
}

class OracleErrorReporterType implements ErrorReporter {
    getError(error: any): string | null {
        if (error === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return OracleErr.ErrorInv[Number(error)];
        }
    }

    getInfo(info: any): string | null {
        if (info === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return OracleErr.FailureInfoInv[Number(info)];
        }
    }

    getDetail(error: any, detail: number): string {
        if (this.getError(error) === "REJECTION") {
            let oracleError = OracleErrorReporter.getError(detail);

            if (oracleError) {
                return oracleError;
            }
        }

        return detail.toString();
    }
}

class FactoryErrorReporterType implements ErrorReporter {
    getError(error: any): string | null {
        if (error === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return FactoryErr.ErrorInv[Number(error)];
        }
    }

    getInfo(info: any): string | null {
        if (info === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return FactoryErr.FailureInfoInv[Number(info)];
        }
    }

    getDetail(error: any, detail: number): string {
        if (this.getError(error) === "REJECTION") {
            let factoryError = FactoryErrorReporter.getError(detail);

            if (factoryError) {
                return factoryError;
            }
        }

        return detail.toString();
    }
}

class RegistryErrorReporterType implements ErrorReporter {
    getError(error: any): string | null {
        if (error === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return RegistryErr.ErrorInv[Number(error)];
        }
    }

    getInfo(info: any): string | null {
        if (info === null) {
            return null;
        } else {
            // TODO: This probably isn't right...
            return RegistryErr.FailureInfoInv[Number(info)];
        }
    }

    getDetail(error: any, detail: number): string {
        if (this.getError(error) === "REJECTION") {
            let registryError = RegistryErrorReporter.getError(detail);

            if (registryError) {
                return registryError;
            }
        }

        return detail.toString();
    }
}

export function formatResult(errorReporter: ErrorReporter, result: any): string {
  const errorStr = errorReporter.getError(result);
  if (errorStr !== null) {
    return `Error=${errorStr}`
  } else {
    return `Result=${result}`;
  }
}

// Singleton instances
export const NoErrorReporter = new NoErrorReporterType();
export const PTokenErrorReporter = new PTokenErrorReporterType();
export const ControllerErrorReporter = new ControllerErrorReporterType();
export const DistributorErrorReporter = new DistributorErrorReporterType();
export const OracleErrorReporter = new OracleErrorReporterType();
export const FactoryErrorReporter = new FactoryErrorReporterType();
export const RegistryErrorReporter = new RegistryErrorReporterType();
