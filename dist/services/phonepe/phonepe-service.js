"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhonePeService = void 0;
const lru_cache_1 = require("lru-cache");
const phonepe_client_1 = require("./phonepe-client");
const __1 = require("../..");
const utils_1 = require("../../lib/utils");
const secrets_1 = require("../../secrets");
class PhonePeService {
    constructor() {
        // Cache configurations for 1 hour with max 1000 entries
        this.clientCache = new lru_cache_1.LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 60, // 1 hour
        });
        this.configCache = new lru_cache_1.LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 30, // 30 minutes
        });
    }
    static getInstance() {
        if (!PhonePeService.instance) {
            PhonePeService.instance = new PhonePeService();
        }
        return PhonePeService.instance;
    }
    getOutletPhonePeConfig(outletId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            const cacheKey = `outlet_${outletId}`;
            const cachedConfig = this.configCache.get(cacheKey);
            if (cachedConfig) {
                return cachedConfig;
            }
            // Fetch from database
            const phonePeIntegration = yield __1.prismaDB.integration.findFirst({
                where: {
                    restaurantId: outletId,
                    name: "PHONEPE",
                },
                select: {
                    phonePeAPIId: true,
                    phonePeAPISecretKey: true,
                    phonePeMerchantId: true,
                },
            });
            if (!(phonePeIntegration === null || phonePeIntegration === void 0 ? void 0 : phonePeIntegration.phonePeAPIId) ||
                !(phonePeIntegration === null || phonePeIntegration === void 0 ? void 0 : phonePeIntegration.phonePeAPISecretKey) ||
                !(phonePeIntegration === null || phonePeIntegration === void 0 ? void 0 : phonePeIntegration.phonePeMerchantId)) {
                throw new Error(`PhonePe not configured for outlet: ${outletId}`);
            }
            console.log(`decryptData(phonePeIntegration.phonePeAPIId)`, (0, utils_1.decryptData)(phonePeIntegration.phonePeAPIId));
            console.log(`decryptData(phonePeIntegration.phonePeAPISecretKey)`, (0, utils_1.decryptData)(phonePeIntegration.phonePeAPISecretKey));
            console.log(`decryptData(phonePeIntegration.phonePeMerchantId)`, (0, utils_1.decryptData)(phonePeIntegration.phonePeMerchantId));
            const config = {
                clientId: (0, utils_1.decryptData)(phonePeIntegration.phonePeAPIId),
                clientSecret: (0, utils_1.decryptData)(phonePeIntegration.phonePeAPISecretKey),
                merchantId: (0, utils_1.decryptData)(phonePeIntegration.phonePeMerchantId),
                environment: secrets_1.ENV === "development" ? "SANDBOX" : "PRODUCTION",
            };
            // Cache the configuration
            this.configCache.set(cacheKey, config);
            return config;
        });
    }
    getGlobalPhonePeConfig() {
        const cacheKey = "global_phonepe";
        const cachedConfig = this.configCache.get(cacheKey);
        if (cachedConfig) {
            return cachedConfig;
        }
        const config = {
            clientId: secrets_1.PHONE_PE_CLIENT_ID,
            clientSecret: secrets_1.PHONE_PE_CLIENT_SECRET,
            merchantId: secrets_1.PHONE_PE_MERCHANT_ID,
            environment: secrets_1.ENV === "development" ? "SANDBOX" : "PRODUCTION",
        };
        this.configCache.set(cacheKey, config);
        return config;
    }
    getOutletClient(outletId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `client_outlet_${outletId}`;
            const cachedClient = this.clientCache.get(cacheKey);
            if (cachedClient) {
                return cachedClient;
            }
            const config = yield this.getOutletPhonePeConfig(outletId);
            const client = new phonepe_client_1.PhonePeClient(config);
            console.log("cached client", client);
            this.clientCache.set(cacheKey, client);
            return client;
        });
    }
    getGlobalClient() {
        const cacheKey = "client_global";
        const cachedClient = this.clientCache.get(cacheKey);
        if (cachedClient) {
            return cachedClient;
        }
        const config = this.getGlobalPhonePeConfig();
        const client = new phonepe_client_1.PhonePeClient(config);
        this.clientCache.set(cacheKey, client);
        return client;
    }
    // Utility methods for cache management
    clearOutletCache(outletId) {
        this.clientCache.delete(`client_outlet_${outletId}`);
        this.configCache.delete(`outlet_${outletId}`);
    }
    clearAllCache() {
        this.clientCache.clear();
        this.configCache.clear();
    }
    // Health check method
    getCacheStats() {
        return {
            clientCache: {
                size: this.clientCache.size,
                calculatedSize: this.clientCache.calculatedSize,
            },
            configCache: {
                size: this.configCache.size,
                calculatedSize: this.configCache.calculatedSize,
            },
        };
    }
}
exports.PhonePeService = PhonePeService;
