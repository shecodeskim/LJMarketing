import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@ljmarketingkenya.co.ke'

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { userId, productId, productName, userEmail } = await req.json()

    if (!userId || !productId || !productName || !userEmail) {
      return new Response('Missing required fields', { status: 400 })
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!)

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return new Response('Product not found', { status: 404 })
    }

    // Generate signed URL for the file
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('products')
      .createSignedUrl(product.file_path || `${productId}.pdf`, 86400) // 24 hours expiry

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      return new Response('Error generating download link', { status: 500 })
    }

    // Send email using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: userEmail,
        subject: `Your Purchase: ${productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #0b1f3a; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #c9a84c; margin: 0;">L&J Marketing Kenya</h1>
              <p style="color: #fafaf8; margin: 10px 0 0;">Your Digital Product Delivery</p>
            </div>
            <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #0b1f3a; margin-top: 0;">Thank you for your purchase!</h2>
              <p style="color: #333; line-height: 1.6;">
                Your payment has been successfully processed. Here are your product details:
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #0b1f3a; margin-top: 0;">${productName}</h3>
                <p style="color: #666; font-size: 14px;">Purchase Date: ${new Date().toLocaleDateString('en-KE')}</p>
              </div>
              <p style="color: #333; line-height: 1.6;">
                Click the button below to download your product. This link is valid for 24 hours.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signedUrlData.signedUrl}" 
                   style="background: #c9a84c; color: #0b1f3a; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Download Your Product
                </a>
              </div>
              <p style="color: #666; font-size: 12px; text-align: center;">
                If you have any issues, please contact us via WhatsApp: 0740 788 160
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>L&J Marketing Kenya · KMA Centre, Upperhill, Nairobi</p>
            </div>
          </div>
        `
      })
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('Email send error:', errorData)
      return new Response('Failed to send email', { status: 500 })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Product delivered successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Deliver product error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
