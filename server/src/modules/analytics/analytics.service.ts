import { prisma } from '../../config/database';

export class AnalyticsService {
  async getOverview(merchantId: string) {
    const intents = await prisma.paymentIntent.findMany({
      where: { merchantId },
      select: {
        status: true,
        amount: true,
        capturedAmount: true,
        refundedAmount: true,
      },
    });

    const totalIntents = intents.length;
    let successfulIntents = 0;
    let failedIntents = 0;
    let grossVolume = BigInt(0);
    let refundedVolume = BigInt(0);

    for (const intent of intents) {
      if (
        intent.status === 'SUCCEEDED' ||
        intent.status === 'PARTIALLY_REFUNDED' ||
        intent.status === 'REFUNDED'
      ) {
        successfulIntents++;
        grossVolume += intent.capturedAmount;
        refundedVolume += intent.refundedAmount;
      } else if (intent.status === 'FAILED') {
        failedIntents++;
      }
    }

    const netVolume = grossVolume - refundedVolume;
    const successRate = totalIntents > 0 ? (successfulIntents / totalIntents) * 100 : 0;

    // Total attempts across all intents for this merchant
    const totalAttempts = await prisma.paymentAttempt.count({
      where: { paymentIntent: { merchantId } },
    });

    const successfulAttempts = await prisma.paymentAttempt.count({
      where: { paymentIntent: { merchantId }, status: 'SUCCEEDED' },
    });

    const conversionRate =
      totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;

    return {
      totalIntents,
      successfulIntents,
      failedIntents,
      successRate: Number(successRate.toFixed(2)),
      grossVolume: grossVolume.toString(),
      refundedVolume: refundedVolume.toString(),
      netVolume: netVolume.toString(),
      totalAttempts,
      successfulAttempts,
      conversionRate: Number(conversionRate.toFixed(2)),
    };
  }

  async getDailyTrends(merchantId: string, days = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const intents = await prisma.paymentIntent.findMany({
      where: {
        merchantId,
        createdAt: { gte: startDate },
        status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      select: {
        createdAt: true,
        capturedAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by YYYY-MM-DD
    const trendMap = new Map<string, { date: string; volume: bigint; count: number }>();

    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      trendMap.set(dateKey, { date: dateKey, volume: BigInt(0), count: 0 });
    }

    for (const intent of intents) {
      const dateKey = intent.createdAt.toISOString().split('T')[0];
      const entry = trendMap.get(dateKey);
      if (entry) {
        entry.volume += intent.capturedAmount;
        entry.count += 1;
      }
    }

    return Array.from(trendMap.values()).map((e) => ({
      date: e.date,
      volume: e.volume.toString(),
      count: e.count,
    }));
  }

  async getPaymentMethodDistribution(merchantId: string) {
    const methods = await prisma.paymentAttempt.groupBy({
      by: ['paymentMethod'],
      where: {
        paymentIntent: { merchantId },
        status: 'SUCCEEDED',
      },
      _count: { paymentMethod: true },
    });

    return methods.map((m) => ({
      method: m.paymentMethod || 'card',
      count: m._count.paymentMethod,
    }));
  }
}

export const analyticsService = new AnalyticsService();
