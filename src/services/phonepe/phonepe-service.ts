import { LRUCache } from "lru-cache";

import { PhonePeClient } from "./phonepe-client";
import { PhonePeConfig } from "../../types/phonepe.types";
import { prismaDB } from "../..";
import { decryptData } from "../../lib/utils";
import {
  ENV,
  PHONE_PE_CLIENT_ID,
  PHONE_PE_CLIENT_SECRET,
  PHONE_PE_MERCHANT_ID,
} from "../../secrets";

export class PhonePeService {
  private static instance: PhonePeService;
  private clientCache: LRUCache<string, PhonePeClient>;
  private configCache: LRUCache<string, PhonePeConfig>;

  private constructor() {
    // Cache configurations for 1 hour with max 1000 entries
    this.clientCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });

    this.configCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 30, // 30 minutes
    });
  }

  public static getInstance(): PhonePeService {
    if (!PhonePeService.instance) {
      PhonePeService.instance = new PhonePeService();
    }
    return PhonePeService.instance;
  }

  private async getOutletPhonePeConfig(
    outletId: string
  ): Promise<PhonePeConfig> {
    // Check cache first
    const cacheKey = `outlet_${outletId}`;
    const cachedConfig = this.configCache.get(cacheKey);
    if (cachedConfig) {
      return cachedConfig;
    }

    // Fetch from database
    const phonePeIntegration = await prismaDB.integration.findFirst({
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

    if (
      !phonePeIntegration?.phonePeAPIId ||
      !phonePeIntegration?.phonePeAPISecretKey ||
      !phonePeIntegration?.phonePeMerchantId
    ) {
      throw new Error(`PhonePe not configured for outlet: ${outletId}`);
    }

    console.log(
      `decryptData(phonePeIntegration.phonePeAPIId)`,
      decryptData(phonePeIntegration.phonePeAPIId)
    );
    console.log(
      `decryptData(phonePeIntegration.phonePeAPISecretKey)`,
      decryptData(phonePeIntegration.phonePeAPISecretKey)
    );
    console.log(
      `decryptData(phonePeIntegration.phonePeMerchantId)`,
      decryptData(phonePeIntegration.phonePeMerchantId)
    );

    const config: PhonePeConfig = {
      clientId: decryptData(phonePeIntegration.phonePeAPIId),
      clientSecret: decryptData(phonePeIntegration.phonePeAPISecretKey),
      merchantId: decryptData(phonePeIntegration.phonePeMerchantId),
      environment: ENV === "development" ? "SANDBOX" : "PRODUCTION",
    };

    // Cache the configuration
    this.configCache.set(cacheKey, config);
    return config;
  }

  private getGlobalPhonePeConfig(): PhonePeConfig {
    const cacheKey = "global_phonepe";
    const cachedConfig = this.configCache.get(cacheKey);
    if (cachedConfig) {
      return cachedConfig;
    }

    const config: PhonePeConfig = {
      clientId: PHONE_PE_CLIENT_ID,
      clientSecret: PHONE_PE_CLIENT_SECRET,
      merchantId: PHONE_PE_MERCHANT_ID,
      environment: ENV === "development" ? "SANDBOX" : "PRODUCTION",
    };

    this.configCache.set(cacheKey, config);
    return config;
  }

  public async getOutletClient(outletId: string): Promise<PhonePeClient> {
    const cacheKey = `client_outlet_${outletId}`;
    const cachedClient = this.clientCache.get(cacheKey);
    if (cachedClient) {
      return cachedClient;
    }

    const config = await this.getOutletPhonePeConfig(outletId);
    const client = new PhonePeClient(config);

    console.log("cached client", client);

    this.clientCache.set(cacheKey, client);
    return client;
  }

  public getGlobalClient(): PhonePeClient {
    const cacheKey = "client_global";
    const cachedClient = this.clientCache.get(cacheKey);
    if (cachedClient) {
      return cachedClient;
    }

    const config = this.getGlobalPhonePeConfig();
    const client = new PhonePeClient(config);

    this.clientCache.set(cacheKey, client);
    return client;
  }

  // Utility methods for cache management
  public clearOutletCache(outletId: string): void {
    this.clientCache.delete(`client_outlet_${outletId}`);
    this.configCache.delete(`outlet_${outletId}`);
  }

  public clearAllCache(): void {
    this.clientCache.clear();
    this.configCache.clear();
  }

  // Health check method
  public getCacheStats() {
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
