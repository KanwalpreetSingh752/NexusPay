import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Package,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const CheckoutDemoPage: React.FC = () => {
  const { merchant } = useAuth();

  const [amount, setAmount] = useState(499); // In Rupees
  const [description, setDescription] = useState('DevOps Pro Cloud License');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'intent_created' | 'verifying' | 'settled' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [settledResult, setSettledResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    setStep('intent_created');
    setStatusMessage('Step 1: Contacting NexusPay API with atomic Idempotency-Key...');

    const amountInPaise = Math.round(amount * 100);
    const idempotencyKey = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Create PaymentIntent on NexusPay
      const res = await api.post(
        '/payments/intents',
        {
          amount: amountInPaise,
          currency: merchant?.currency || 'INR',
          description,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      const { intentId, providerOrderId, razorpayKeyId } = res.data.data;
      setStatusMessage(`Step 2: PaymentIntent (${intentId.slice(0, 8)}) created. Launching Razorpay Modal...`);

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: razorpayKeyId || 'rzp_test_NexusDemoKey01',
        amount: amountInPaise,
        currency: merchant?.currency || 'INR',
        name: merchant?.businessName || 'NexusPay Merchant',
        description,
        order_id: providerOrderId,
        prefill: {
          name: 'Placement Interviewer',
          email: 'interviewer@techcorp.com',
          contact: '9999999999',
        },
        theme: {
          color: '#0284c7',
        },
        handler: async (response: any) => {
          await verifyPayment(response);
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            if (step !== 'settled') {
              setStep('idle');
              setStatusMessage('Checkout modal dismissed by user.');
            }
          },
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback: trigger simulated verification directly
        setStatusMessage('Razorpay script offline. Triggering instant simulated verification...');
        setTimeout(() => {
          verifyPayment({
            razorpay_order_id: providerOrderId,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            razorpay_signature: 'simulated_valid_signature',
          });
        }, 1200);
      }
    } catch (err: any) {
      setStep('error');
      setStatusMessage(err.response?.data?.error?.message || 'Failed to initiate checkout.');
      setLoading(false);
    }
  };

  const verifyPayment = async (razorpayResponse: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setStep('verifying');
    setStatusMessage('Step 3: Server verifying HMAC cryptographic signature & checking provider state...');

    try {
      const verifyRes = await api.post('/payments/verify', {
        razorpayOrderId: razorpayResponse.razorpay_order_id,
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
        razorpaySignature: razorpayResponse.razorpay_signature,
      });

      setSettledResult(verifyRes.data.data);
      setStep('settled');
      setStatusMessage('Step 4: Payment verified, journaled, and settled successfully!');
    } catch (err: any) {
      setStep('error');
      setStatusMessage(err.response?.data?.error?.message || 'Signature verification rejected by server.');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    if (settledResult) {
      navigator.clipboard.writeText(JSON.stringify(settledResult, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Interactive Checkout Demo</h1>
        <p className="text-sm text-slate-400 mt-1">
          Demonstrate end-to-end payment processing, Razorpay Test Mode integration, and server-side state settlement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Checkout Card */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="h-10 w-10 rounded-lg bg-sky-950/80 border border-sky-800/60 text-sky-400 flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Order Summary</h3>
                <p className="text-xs text-slate-400">Sample merchant checkout flow</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Product Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount in Rupees (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-sky-500 font-semibold"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Converts to {Math.round(amount * 100)} integer minor units (paise) internally.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Due</span>
              <span className="text-xl font-bold text-white">₹{amount.toFixed(2)}</span>
            </div>

            <button
              onClick={startCheckout}
              disabled={loading || amount <= 0}
              className="w-full py-3 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 shadow-lg shadow-sky-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Pay ₹{amount.toFixed(2)} (Test Mode)</span>
                </>
              )}
            </button>
          </div>

          {/* Test Card Guide */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">💡 Interview Sandbox Test Data</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">Success Visa:</span>
                <span className="font-mono text-emerald-400">4111 1111 1111 1111</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">Decline Card:</span>
                <span className="font-mono text-rose-400">4111 1111 1111 1112</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">UPI ID:</span>
                <span className="font-mono text-sky-400">success@razorpay</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block">Expiry / CVV:</span>
                <span className="font-mono text-slate-300">Any future / 123</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Live Monitor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              <span>Gateway State Monitor</span>
            </h3>

            {/* Status Stepper */}
            <div className="space-y-3">
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-3 transition ${
                  step === 'idle'
                    ? 'bg-slate-950 border-slate-800 text-slate-400'
                    : step === 'error'
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : step === 'settled'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-sky-950/40 border-sky-800 text-sky-300'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : step === 'settled' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : step === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-600 shrink-0"></div>
                )}
                <span>{statusMessage || 'Awaiting customer checkout initiation...'}</span>
              </div>
            </div>

            {/* Settled Details */}
            {settledResult && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Settlement Receipt
                  </span>
                  <button
                    onClick={copyResult}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1">
                  <p>
                    <span className="text-slate-500">status:</span>{' '}
                    <span className="text-emerald-400 font-bold">{settledResult.status}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">intentId:</span> {settledResult.intentId}
                  </p>
                  <p>
                    <span className="text-slate-500">amount:</span> ₹{Number(settledResult.amount) / 100}
                  </p>
                  <p>
                    <span className="text-slate-500">providerPaymentId:</span>{' '}
                    {settledResult.providerPaymentId}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
