**Notice:** This project is discontinued and no longer maintained nor supported by Tresorit. This repository only exists for archival purposes.
***
# ZeroKit Node.js SDK 
This is the Node.js of [ZeroKit](https://tresorit.com/zerokit), that lets you encrypt and decrypt data for server side processing.
 
This small SDK loads and wraps the components of the ZeroKit to enable it to work in the Node.js environment,
using the built-in native crypto functions instead of WebCrypto, and using an in-memory storage instead of 
session, local and cookie storages.

The ZeroKit Node.js client SDK is currently under development and is accessible as a preview. We continuously improve it and fix bugs. Feedback is always welcome.

## Disclaimer
You should be aware, that using this SDK to process user data on the server will violate
 the zero knowledge property of your backend, exposing data to your server and potentially
 to your administrators and anyone having access to the server.
 
You should take special care about how you store the credentials used to log into ZeroKit as they
 could later be used to decrypt any data the server had access to.

## Usage
The sdk exports a single function that takes your service URL and the SDK version as arguments.
This method loads the sdk asynchronously, that you can use in the same manner as
the web SDK.

You can see a detailed documentation at [https://tresorit.com/zerokit/docs]()

Example (current Node.js):
```javascript
const zkit_sdkProm = require('zerokit-node-client')("https://tenantid.api.tresorit.io", 4)

async function testZeroKitDecrypt(uploadedUserData) { 
  const zkit_sdk = await zkit_sdkProm;
  
  await zkit_sdk.login('12121212121212.testuser@testtenant.tresorit.io', "password");
  
  return await zkit_sdk.decrypt(uploadedUserData);
}
```

Go ahead to the [management portal](https://manage.tresorit.io) and find out more in the documentation and 
check the full set of features provided by ZeroKit!

## Requirements
First, to use the SDK you need a tenant server (basically a subscription to ZeroKit).
You can get one for free [here](https://tresorit.com/zerokit),
where you can also find a detailed documentation and sample apps for many platforms. You can also get the relevant
example from [GitHub](https://github.com/tresorit).
