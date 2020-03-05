import Axios from 'axios';
import { addSeconds, differenceInMinutes } from 'date-fns';
import querystring from 'query-string';
import * as uuid from 'uuid';

interface BanklyAuthentication {
  grant_type: string;
  client_id: string;
  client_secret: string;
}

interface TransferData {
  amount: number;
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

class BanklyLib {

  private urlToken = 'https://login.acessobank.com.br/connect/token'
  private urlBase = 'https://api.bankly.com.br'
  private credentials: BanklyAuthentication

  private token: string
  private tokenType: string = 'Bearer'
  private tokenEnds: Date

  public constructor(credentials: BanklyAuthentication) {
    this.credentials = credentials;
  }

  public getNewToken = async () => {
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
  }

  public getToken = async () => {
    const difference = differenceInMinutes(new Date(), this.tokenEnds);
    if (this.token && difference >= 15) {
      return this.token;
    }
    await this.getNewToken();
    return this.token;
  }

  public getEvents = async (agency: string, account: string) => {
    const response = await Axios.get(`${this.urlBase}/baas/events?branch=${agency}&account=${account}&IncludeDetails=true`, {
      headers: {
        'api-version': '1',
        'x-correlation-id': uuid.v4(),
        Authorization: `${this.tokenType} ${await this.getToken()}`,
      },
    });
    return {
      totalItens: response.data.totalItens,
      itens: response.data.itens,
      pageIndex: response.data.pageIndex,
    };
  }

  public sendTransfer = async (options: TransferData) => {
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
  }

  public getTransfer = async (authenticationId: string, branch: string, account: string) => {
    const response: {
      data: {
        status: { name: string; timeOfStatus: string; }[]
      }
    } = await Axios.get(`${this.urlBase}/api/fund-transfers/${authenticationId}/status?branch=${branch}&account=${account}`, {
      headers: {
        'api-version': '1',
        'x-correlation-id': uuid.v4(),
        Authorization: `${this.tokenType} ${await this.getToken()}`,
      },
    });
    return {
      status: response.data.status,
    };
  }

  public getBalance = async (branch: string, account: string) => {
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

    return { ...response.data };
  }

};

export default BanklyLib;
