'use strict';

const request = require('request-promise-native');
const aws = require('aws-sdk');

class ServerlessPlugin {
  constructor (serverless, options) {
    this.serverless = serverless;
    this.options = options;
    const vault = this.serverless.pluginManager.cliOptions.vault;
    if (vault) {
      this.hooks = {
        'before:offline:start:init': this.start.bind(this),
        'before:package:initialize': this.start.bind(this)
      }
    } else {
      this.serverless.cli.log('VAULT: Disabled load VAULT variables');
    }
    this.kms = new aws.KMS({ region: this.options.region || 'us-east-1' });
  }


  async kmsEncryptVariable (key, value) {
    const params = {
      KeyId: this.serverless.service.custom.kms.keyId,
      Plaintext: Buffer.from(String(value))
    };
    const hashValue = await this.kms.encrypt(params).promise();
    return {
      key,
      value: hashValue.CiphertextBlob.toString('base64')
    };
  }

  async getEnvsFromVault (baseUrl) {
    const ssl = this.serverless.service.custom.vault.ssl_check || false;
    const method = ssl ? 'https://' : 'http://';
    const myOptions = {
      url: `${method}${baseUrl}`,
      method: 'GET',
      headers: {
        'X-Vault-Token': this.serverless.service.custom.vault.token,
        'Content-Type': 'application/json',
      },
      strictSSL: ssl
    };
    try {
      const response = await request.get(myOptions).promise();
      const { data } = JSON.parse(response);
      return {
        ...data.data
      };
    } catch (error) {
      this.serverless.cli.log('VAULT: Error to authenticate on Vault: ' + error.message);
      return Promise.reject(error);
    }
  }


  mountBaseUrl (path) {
    const splitPath = path.split('/');
    let secretBase = splitPath[0] + '/data';
    splitPath.forEach((item, index) => {
      if (index > 0) {
        secretBase += '/' + item;
      }
    });
    return `${this.serverless.service.custom.vault.url}/v1/${secretBase}`;
  }

  async start () {
    try {
      const environments = this.serverless.service.provider.environment;
      const keysToVault = Object.keys(environments).map(key => key);
      const envs = await this.getEnvByPaths();
      let keysMounted = {};
      this.serverless.cli.log('VAULT: Loading environments variables from VAULT server...');
      keysToVault.forEach(key => {
        if (envs[key]) {
          keysMounted[key] = envs[key];
          process.env[key] = envs[key];
        }
      });
      if (this.serverless.service.custom.kms) {
        this.serverless.cli.log('VAULT: Encrypting environments variables...');
        const hashVariablesPromise = Object.keys(keysMounted).map(key => {
          return this.kmsEncryptVariable(key, keysMounted[key]);
        });
        const hashVariablesResponse = await Promise.all(hashVariablesPromise);
        hashVariablesResponse.forEach(item => {
          if (keysMounted[item.key]) {
            keysMounted[item.key] = item.value;
          }
        });
      } else {
        this.serverless.cli.log('VAULT: KMS ID not found, skipping encrypting ...');
      }
      this.serverless.cli.log('VAULT: Done');
      this.serverless.service.provider.environment = {
        ...environments,
        ...keysMounted
      };
    } catch (error) {
      this.serverless.cli.log('VAULT: Error to authenticate on Vault: ' + error.message);
      return Promise.reject(error);
    }
  }

  async getEnvByPaths () {
    const paths = this.serverless.service.custom.vault.paths;
    let envs = {};
    if (typeof paths === 'string') {
      envs = await this.getEnvsFromVault(this.mountBaseUrl(paths));
    } else {
      const promisePaths = paths.map(path => this.getEnvsFromVault(this.mountBaseUrl(path)))
      const resolvePaths = await Promise.all(promisePaths);
      resolvePaths.forEach(async values => {
        envs = {
          ...envs,
          ...values
        }
      });
    }
    return envs;
  }
}

module.exports = ServerlessPlugin;