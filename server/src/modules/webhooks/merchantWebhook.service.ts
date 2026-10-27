import crypto from 'crypto';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/apiError';
import { RegisterWebhookEndpointInput, UpdateWebhookEndpointInput } from './merchantWebhook.schema';

export class MerchantWebhookService {
  async registerEndpoint(merchantId: string, input: RegisterWebhookEndpointInput) {
    const rawSecret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

    const endpoint = await prisma.merchantWebhookEndpoint.create({
      data: {
        merchantId,
        url: input.url,
        secretHash,
        subscribedEvents: input.subscribedEvents,
        isActive: true,
      },
    });

    return {
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        subscribedEvents: endpoint.subscribedEvents,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
      },
      secret: rawSecret, // Displayed once for configuration in merchant's server
    };
  }

  async listEndpoints(merchantId: string) {
    const endpoints = await prisma.merchantWebhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { deliveries: true } },
      },
    });

    return endpoints.map((ep) => ({
      id: ep.id,
      url: ep.url,
      subscribedEvents: ep.subscribedEvents,
      isActive: ep.isActive,
      deliveryCount: ep._count.deliveries,
      createdAt: ep.createdAt,
    }));
  }

  async updateEndpoint(merchantId: string, endpointId: string, input: UpdateWebhookEndpointInput) {
    const endpoint = await prisma.merchantWebhookEndpoint.findFirst({
      where: { id: endpointId, merchantId },
    });

    if (!endpoint) {
      throw ApiError.notFound('Webhook endpoint not found');
    }

    return await prisma.merchantWebhookEndpoint.update({
      where: { id: endpointId },
      data: {
        url: input.url ?? endpoint.url,
        isActive: input.isActive ?? endpoint.isActive,
        subscribedEvents: input.subscribedEvents ?? endpoint.subscribedEvents,
      },
    });
  }

  async deleteEndpoint(merchantId: string, endpointId: string) {
    const endpoint = await prisma.merchantWebhookEndpoint.findFirst({
      where: { id: endpointId, merchantId },
    });

    if (!endpoint) {
      throw ApiError.notFound('Webhook endpoint not found');
    }

    await prisma.merchantWebhookEndpoint.delete({
      where: { id: endpointId },
    });

    return { success: true };
  }

  async listDeliveries(merchantId: string, endpointId: string) {
    const endpoint = await prisma.merchantWebhookEndpoint.findFirst({
      where: { id: endpointId, merchantId },
    });

    if (!endpoint) {
      throw ApiError.notFound('Webhook endpoint not found');
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { event: true },
    });

    return deliveries;
  }
}

export const merchantWebhookService = new MerchantWebhookService();
