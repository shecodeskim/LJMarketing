/*import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    
    // Parse request body
    const { action, reference, productId, productName, amount, userId } = await req.json()

    if (!reference) throw new Error('Reference is required')

    // 1. Verify Transaction with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    const verifyData = await verifyResponse.json()

    if (!verifyData.status || verifyData.data.status !== 'success') {
      throw new Error('Payment verification failed')
    }

    // 2. Handle Subscription Tokenization
    if (action === 'tokenize') {
      const customerCode = verifyData.data.customer.customer_code;
      const authorizationCode = verifyData.data.authorization.authorization_code;

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { error: subError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: 'trialing',
          trial_ends_at: trialEndDate.toISOString(),
          paystack_customer_code: customerCode,
          paystack_authorization_code: authorizationCode,
          tokenization_reference: reference
        }, { onConflict: 'user_id' })

      if (subError) throw subError;
      return new Response(JSON.stringify({ success: true, message: 'Trial activated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Handle Product Purchase
    if (action === 'purchase') {
      // Record payment
      const { data: payment, error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          user_id: userId,
          reference: reference,
          amount_kes: amount,
          channel: verifyData.data.channel || 'card',
          status: 'success'
        })
        .select()
        .single()

      if (paymentError) throw paymentError;

      // Grant product access
      const { error: purchaseError } = await supabaseClient
        .from('product_purchases')
        .insert({
          user_id: userId,
          product_id: productId,
          product_name: productName,
          payment_id: payment.id,
          access_granted: true
        })

      if (purchaseError) throw purchaseError;

      return new Response(JSON.stringify({ success: true, message: 'Purchase successful' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Invalid action');

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}) */