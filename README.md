# Serverless Plugin Vault V2

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![vault enterprise](https://img.shields.io/badge/vault-enterprise-yellow.svg?colorB=7c8797&colorA=000000)](https://www.hashicorp.com/products/vault/?utm_source=github&utm_medium=banner&utm_campaign=github-vault-enterprise)


## Features

   * Integrates with serverless-plugin-dotenv
   * Get the environments variables from your **Personal VAULT Server** (API V2)
   * Integrates with Key Management Service (AWS)

## Instalation and use

```sh
yarn add --dev serverless-plugin-vault-v2
```
or
```
npm install --save-dev serverless-plugin-vault-v2
```

Add at the end of the list of plugins to your `serverless.yml`:

```yaml
plugins:
  - 'plugin1'
  - 'plugin2'
  ...
  - 'serverless-plugin-vault-v2'
```

## Vault Configuration

The configuration to initialize:

```yaml
custom:
    vault:
        token: "<TOKEN_OF_USER>"
        url: <SERVER_URL>"
        paths: ["PATH_STORE1", ...]
        ssl_check: boolean
```

## KMS Configuration

To add the kms integration, just put the Kms object with your vault configuration:

```yaml
custom:
    vault:
        ...
    kms:
        keyId: <"KMS_ID">
```

License
----
MIT
