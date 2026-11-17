import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { productId } = await req.json()

    if (!productId) {
      return new Response('productId is required', { status: 400 })
    }

    // Get authorization header to verify user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Initialize Supabase client with service role key for admin access
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

    // Generate signed URL for the file in storage
    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from('products')
      .createSignedUrl(product.file_path || `${productId}.pdf`, 3600) // 1 hour expiry

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError)
      return new Response('Error generating download link', { status: 500 })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      downloadUrl: signedUrlData.signedUrl,
      productName: product.name
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Download product error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
