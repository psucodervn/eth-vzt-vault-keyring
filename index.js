const type = "Vzt Vault";
const EventEmitter = require("events").EventEmitter;
const API_URL = "http://pro.vwallet.vzota.com/metamask/public/index.html";
const browser = require("webextension-polyfill");

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

class VztVaultKeyring extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.apiUrl = null;
    this.type = type;
    this.token = null;
    this.accounts = [];
    this.unlockedAccount = 0;
    this.unlockedAccounts = [];
    this.deserialize(opts);
    this._setupIframe();
  }

  serialize() {
    return Promise.resolve({
      accounts: this.accounts,
      apiUrl: this.apiUrl,
      token: this.token
    });
  }

  deserialize(opts = {}) {
    //this.apiUrl = opts.apiUrl || API_URL;
    this.apiUrl = API_URL;
    this.accounts = opts.accounts || [];
    this.accounts.push("0xbe862ad9abfe6f22bcb087716c7d89a26051f74c");
    this.token = opts.token
    return Promise.resolve();
  }

  setAccountToUnlock (index) {
    this.unlockedAccount = parseInt(index, 10)
  }


  addAccounts(n = 1) {  
    console.log("addAccount");
    const account = this.unlockedAccounts[this.unlockedAccount];
    this.accounts = [account.address];
    return Promise.resolve(this.accounts)
  }


  getAccounts () {
    return Promise.resolve(this.accounts.slice())
  }

  removeAccount (address) {
    if (!this.accounts.map(a => a.toLowerCase()).includes(address.toLowerCase())) {
      throw new Error(`Address ${address} not found in this keyring`)
    }
    this.accounts = this.accounts.filter(a => a.toLowerCase() !== address.toLowerCase())
  }
 
  forgetDevice () {
    this.accounts = []
    this.page = 0
    this.unlockedAccount = 0
    this.token = null;
    
  }

  // tx is an instance of the ethereumjs-transaction class.
  async signTransaction(address, tx) {
  
    
    const o = tx.toJSON();
    
   
    const res = await this._sendMessage('vzt-sign-transaction', {
        address, 
        tx: {
          nonce: o[0],
          gasPrice: o[1],
          gasLimit: o[2],
          to: o[3],
          value: o[4],
          data: o[5],
          chainId: tx.getChainId()
        },
        token: this.token
      });
    if (res.success){
      const data = res.data;
      
      tx.v = data.v
      tx.r = data.r
      tx.s = data.s;
      
      const valid = tx.verifySignature();
      
      if (valid) {
        return tx;
      } else {
        throw 'Vzt: The transaction signature is not valid';
      }
    }
    else {
      throw res.message;
    }
  }

  signMessage(address, data) {
    throw new Error("signMessage Not supported on this device");
  }

  signTypedData (withAccount, typedData) {
    throw new Error('signTypedData Not supported on this device')
  }

  signPersonalMessage (withAccount, message) {
    throw new Error("signPersonalMessage Not supported on this device");
  }

  exportAccount(address) {
    throw new Error("exportAccount Not supported on this device");
  }

  getFirstPage() {
    this.page = 0;
    return this._getPage();
  }

  getNextPage() {
    return Promise.resolve([]);
  }

  getPreviousPage() {
    return Promise.resolve([]);
  }

  /* PRIVATE METHODS */
  _getOriginal(){
    const url = new URL(this.apiUrl);
    return url.origin;
  }

  _setupIframe () {
    this.iframe = document.createElement('iframe')
    this.iframe.src = this.apiUrl;
    document.head.appendChild(this.iframe);
    
  }

  async _getPage(){
    const token = this.token || 'vzt:'+uuidv4();
    const tab = await browser.tabs.create({
      url: this.apiUrl +"#"+token
    });
    
    const {success, error, data} = await this._sendMessage(
      'vzt-get-addresses', 
      {token}
    );
    
    browser.tabs.remove(tab.id);  
    if (success) {
      const accounts = [];
      for(let i=0; i<data.length;i++){
        accounts.push({
          index: i,
          address: data[i],
        })
      }
      this.token = token;
      this.unlockedAccounts = accounts;
      return accounts
    }
    else {
      throw error;
    }
  }

  _sendMessage (action, params) {
    return new Promise((ok, fail) => {
      const msg = {
        action, params, target: 'VZVAULT-IFRAME'
      }
     
      this.iframe.contentWindow.postMessage(msg, '*')
      window.addEventListener('message', ({ origin, data }) => {
        if (origin !== this._getOriginal()) return;
        if (data && data.action && data.action === `${msg.action}-reply`) {
          ok(data);
        }
      })
    })
  }

 


}

VztVaultKeyring.type = type;
module.exports = VztVaultKeyring;
