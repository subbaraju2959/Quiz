class UniqueMap {
    constructor() {
        this.keyValueMap = {};
        this.valueKeyMap = {};
    }

    put(key, value) {
        if (this.keyValueMap.hasOwnProperty(key) || this.valueKeyMap.hasOwnProperty(value)) {
            throw new Error("Keys and values must be unique.");
        }
        this.keyValueMap[key] = value;
        this.valueKeyMap[value] = key;
    }

    get(key) {
        return this.keyValueMap[key] || null;
    }

    getByValue(value) {
        return this.valueKeyMap[value] || null;
    }

    remove(key) {
        const value = this.keyValueMap[key];
        if (value !== undefined) {
            delete this.keyValueMap[key];
            delete this.valueKeyMap[value];
        }
    }

    removeByValue(value) {
        const key = this.valueKeyMap[value];
        if (key !== undefined) {
            delete this.keyValueMap[key];
            delete this.valueKeyMap[value];
        }
    }

    getAllKeys() {
        return Object.keys(this.keyValueMap);
    }

    getAllValues() {
        return Object.values(this.keyValueMap);
    }
}
module.exports = UniqueMap;