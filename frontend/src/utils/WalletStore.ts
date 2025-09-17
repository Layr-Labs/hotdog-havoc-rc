class WalletStore {
  private static _address: string = '';

  static setAddress(address: string) {
    this._address = address;
  }

  static getAddress(): string {
    return this._address;
  }

  static clear() {
    this._address = '';
  }
}

export default WalletStore; 