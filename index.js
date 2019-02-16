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
    this.hooks = {
      'before:package:initialize': this.start.bind(this)
    };

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
      this.serverless.cli.log('Problems to retrieve keys from vault: Check your path and your address and make sure you have everything done before run it again');
      this.serverless.cli.log('Error to authenticate on Vault: ' + error.message);
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
      const keysToVault = this.serverless.service.provider.environment;
      const envs = await this.getEnvByPaths();
      let keysMounted = {};
      this.serverless.cli.log('Loading environments variables: ');
      keysToVault.forEach(key => {
        if (envs[key]) {
          this.serverless.cli.log(`- ${key} - <COMPUTED>`);
          keysMounted[key] = envs[key];
        } else {
          this.serverless.cli.log(`- ${key} - <NOT FOUND>`);
        }
      });
      this.serverless.cli.log('Encrypting environments variables...');
      const hashVariablesPromise = Object.keys(keysMounted).map(key => {
        return this.kmsEncryptVariable(key, keysMounted[key]);
      });
      const hashVariablesResponse = await Promise.all(hashVariablesPromise);
      hashVariablesResponse.forEach(item => {
        if (keysMounted[item.key]) {
          keysMounted[item.key] = item.value;
        }
      });
      this.serverless.cli.log('Done');

      this.serverless.service.provider.environment = keysMounted;
    } catch (error) {
      this.serverless.cli.log('Problems to retrieve keys from vault: Check your path and your address and make sure you have everything done before run it again');
      this.serverless.cli.log('Error to authenticate on Vault: ' + error.message);
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