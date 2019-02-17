'use strict';

const request = require('request-promise-native');
const aws = require('aws-sdk');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      vault: {
        lifecycleEvents: [
          'vault',
        ],
        options: {},
      },
    };
    this.kms = new aws.KMS({ region: this.options.region || 'us-east-1' });
    if (this.serverless.pluginManager.cliOptions.vault) {
      this.start();
    }
  }

  async kmsEncryptVariable(key, value) {
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

  async getEnvsFromVault(baseUrl) {
    const myOptions = {
      url: baseUrl,
      method: 'GET',
      headers: {
        'X-Vault-Token': this.serverless.service.custom.vault.token,
        'Content-Type': 'application/json',
      },
      strictSSL: this.serverless.service.custom.vault.ssl_check || false
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


  mountBaseUrl(path) {
    const splitPath = path.split('/');
    let secretBase = splitPath[0] + '/data';
    splitPath.forEach((item, index) => {
      if (index > 0) {
        secretBase += "/" + item;
      }
    });
    return `${this.serverless.service.custom.vault.url}/v1/${secretBase}`;
  }

  async start() {
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
        } else if(!process.env[key]) {
          this.serverless.cli.log(`VAULT: ${key} - <NOT FOUND>`);
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
      this.serverless.service.provider.environment = keysMounted;
    } catch (error) {
      this.serverless.cli.log('VAULT: Error to authenticate on Vault: ' + error.message);
      return Promise.reject(error);
    }
  }

  async getEnvByPaths() {
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