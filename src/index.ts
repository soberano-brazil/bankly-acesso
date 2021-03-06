import Axios from 'axios';
import { addSeconds, differenceInMinutes } from 'date-fns';
import querystring from 'query-string';
import * as uuid from 'uuid';

interface BanklyAuthentication {
  grant_type: 'client_credentials' | 'password';
  client_id: string;
  client_secret: string;
  username?: string;
  password?: string;
}

interface TransferData {
  amount: number;
  description: string;
  sender: {
    branch: string;
    account: string;
    document: string;
    name: string;
  };
  recipient: {
    bankCode: string;
    branch: string;
    account: string;
    document: string;
    name: string;
  };
}

interface ImagesArrayStatus {
  documentType: string,
  documentSide: string,
  uploadDate: string,
  rejectedReasons?: string[],
}

interface ImagesToSend {
  document: string,
  documentType: 'Selfie' | 'RG' | 'CNH',
  documentSide: 'Front' | 'Back'
  file: string,
}

interface UserDataToSend {
  document: string;
  firstName: string;
  surname: string;
  socialName: string;
  password: string;
  countryCallingCode: string;
  phoneNumber: string;
  motherName: string;
  birthday: string;
  email: string;
  address: {
    zipCode: string;
    addressLine: string;
    addressNumber: string;
    complement: string;
    neighborhood: string;
    country: string;
    addressState: string;
    city: string;
  };
}

interface GetEnventsParans {
  agency: string;
  account: string;
  page?: number;
  pageSize?: number;
}

class BanklyLib {

  private urlToken = 'https://login.acessobank.com.br/connect/token'
  private urlBase = 'https://api.bankly.com.br'
  private credentials: BanklyAuthentication

  private token: string
  private tokenType: string = 'Bearer'
  private tokenEnds: Date

  public constructor(credentials: BanklyAuthentication) {
    this.credentials = credentials;
    this.getToken();
  }

  public sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getNewToken = async () => {
    try {
      const response = await Axios.post(this.urlToken,
        querystring.stringify({
          ...this.credentials,
        }),
        {
          headers: {
            'Accept': 'application/x-www-form-urlencoded',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      this.token = response.data.access_token;
      this.tokenType = response.data.token_type;
      this.tokenEnds = addSeconds(new Date(), response.data.expires_in);
      return true;
    } catch (err) {
      throw `getNewToken: ${err.message}`;
    }
  }

  public getToken = async () => {
    const difference = differenceInMinutes(this.tokenEnds, new Date());
    if (this.token && difference >= 15) {
      return this.token;
    }
    await this.getNewToken();
    return this.token;
  }

  public getEvents = async ({ agency, account, page = 1, pageSize = 20 }: GetEnventsParans) => {
    try {
      const response = await Axios.get(`${this.urlBase}/baas/events?Branch=${agency}&Account=${account}&IncludeDetails=true&Page=${page}&Pagesize=${pageSize}`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });
      return response.data;
    } catch (err) {
      throw `getEvents: ${err.message}`;
    }
  }

  public sendTransfer = async (options: TransferData) => {
    try {
      const response = await Axios.post(`${this.urlBase}/baas/fund-transfers`, {
        ...options,
      }, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });
      return {
        authenticationCode: response.data.authenticationCode,
      };
    } catch (err) {
      throw `sendTransfer: ${err.message}`;
    }
  }

  public getTransfer = async (authenticationId: string, branch: string, account: string) => {
    try {
      const response: {
        data: {
          status: { name: string; timeOfStatus: string; }[]
        }
      } = await Axios.get(`${this.urlBase}/baas/fund-transfers/${authenticationId}/status?branch=${branch}&account=${account}`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });
      return {
        status: response.data.status,
      };
    } catch (err) {
      throw `getTransfer: ${err.message}`;
    }
  }

  public getBalance = async (branch: string, account: string) => {
    try {
      const response: {
        data: {
          available: number,
          blocked: number,
        }
      } = await Axios.get(`${this.urlBase}/baas/account/balance?branch=${branch}&account=${account}`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return response.data;
    } catch (err) {
      throw `getBalance: ${err.message}`;
    }
  }

  public getDocumentImageStatus = async (document: string) => {
    try {
      const response: {
        data: {
          document: string,
          lastStatus: {
            situation: string,
            date: string,
          },
          images: ImagesArrayStatus[];
        }
      } = await Axios.get(`${this.urlBase}/baas/documents?document=${document}`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return { ...response.data };
    } catch (err) {
      throw `getDocumentImageStatus: ${err.message}`;
    }
  }

  public getDocumentStatus = async (document: string) => {
    try {
      const response: {
        data: {
          document: string,
          lastStatus: {
            situation: string,
            date: string,
          }
        }
      } = await Axios.get(`${this.urlBase}/baas/onboardstatus/${document}/status`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return { ...response.data };
    } catch (err) {
      throw `getDocumentStatus: ${err.message}`;
    }
  }

  public postCreateAccount = async (document: string) => {
    try {
      const response = await Axios.post(`${this.urlBase}/baas/person-account`, {
        document,
      }, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return response.data;
    } catch (err) {
      throw `postCreateAccount: ${err.message}`;
    }
  }

  public getDocumentAccount = async (document: string) => {
    try {
      const response: {
        data: {
          bankBranch: string,
          accountNumber: string,
        }
      } = await Axios.get(`${this.urlBase}/baas/person-account/${document}`, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return { ...response.data };
    } catch (err) {
      throw `getDocumentAccount: ${err.message}`;
    }
  }

  public postImagesDocument = async (data: ImagesToSend) => {
    try {
      const response = await Axios.post(`${this.urlBase}/baas/documents`, data, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
        maxContentLength: Infinity,
      });

      return response.data;
    } catch (err) {
      throw `postImagesDocument: ${err.message}`;
    }
  }

  public postUserData = async (data: UserDataToSend) => {
    try {
      const response = await Axios.post(`${this.urlBase}/baas/person-rating`, data, {
        headers: {
          'api-version': '1',
          'x-correlation-id': uuid.v4(),
          Authorization: `${this.tokenType} ${await this.getToken()}`,
        },
      });

      return response.data;
    } catch (err) {
      throw `postUserData: ${err.message}`;
    }
  }

};

export default BanklyLib;
