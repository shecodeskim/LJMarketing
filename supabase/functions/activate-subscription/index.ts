import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PAYSTACK_PLAN_CODE = Deno.env.get('PAYSTACK_PLAN_CODE')!

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { userId } = await req.json()

    if (!userId) {
      return new Response('userId is required', { status: 400 })
    }

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (subError || !subscription) {
      return new Response('Subscription not found', { status: 404 })
    }

    // Check if subscription is already active
    if (subscription.status === 'active') {
      return new Response('Subscription is already active', { status: 400 })
    }

    // Check if we have the required Paystack codes
    if (!subscription.paystack_customer_code || !subscription.paystack_authorization_code) {
      return new Response('Missing Paystack authorization codes. Please re-subscribe.', { status: 400 })
    }

    // Create subscription on Paystack using stored authorization codes
    const paystackResponse = await fetch('https://api.paystack.co/subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: subscription.paystack_customer_code,
        plan: PAYSTACK_PLAN_CODE,
        authorization: subscription.paystack_authorization_code
      })
    })

    const paystackData = await paystackResponse.json()

    if (!paystackData.status) {
      console.error('Paystack subscription creation failed:', paystackData)
      return new Response(JSON.stringify({ error: 'Failed to create Paystack subscription', details: paystackData }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate next billing date (1 month from now)
    const nextBillingDate = new Date()
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

    // Update subscription in Supabase to active
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: nextBillingDate.toISOString(),
        trial_ends_at: null // Clear trial end date
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to update subscription:', updateError)
      return new Response('Failed to update subscription status', { status: 500 })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Subscription activated successfully',
      paystackSubscription: paystackData.data
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error activating subscription:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
