# Serverless Plugin Vault V2

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![vault enterprise](https://img.shields.io/badge/vault-enterprise-yellow.svg?colorB=7c8797&colorA=000000)](https://www.hashicorp.com/products/vault/?utm_source=github&utm_medium=banner&utm_campaign=github-vault-enterprise)


## Features

   * Working with serverless-plugin-dotenv
   * Get the environments variables from your [Hashicorp VAULT!](https://www.vaultproject.io/) (API V2)
   * Integrates with Key Management Service (AWS)

## Instalation

```sh
yarn add --dev serverless-plugin-vault-v2
```
or
```
npm install --save-dev serverless-plugin-vault-v2
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

## Use

To activate the Vault Service use the flag --vault after serverless command **deploy** and with serverless offline the command **offline start**.
Examples:
```sh
serverless deploy --vault
```
and
```
serverless offline start --vault
```

License
----
MIT
