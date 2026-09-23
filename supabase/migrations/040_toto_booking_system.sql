-- ==============================================================================
-- Migration 040: Toto Booking, Dispatch, Bengali Agreements, and Audit System
-- ==============================================================================

-- 1. Toto Riders Table (Registered Drivers)
CREATE TABLE IF NOT EXISTS public.toto_riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    toto_number VARCHAR(50) NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    duty_status VARCHAR(30) DEFAULT 'online_available' CHECK (duty_status IN ('offline', 'online_available', 'busy_on_trip')),
    agreement_accepted_at TIMESTAMPTZ,
    last_known_lat DOUBLE PRECISION,
    last_known_lng DOUBLE PRECISION,
    last_location_updated_at TIMESTAMPTZ,
    rating_avg NUMERIC(3, 2) DEFAULT 5.00,
    total_rides_completed INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_toto_rider_phone UNIQUE (account_id, phone_number)
);

-- 2. Toto Customers Table (Ride Requesters)
CREATE TABLE IF NOT EXISTS public.toto_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    name VARCHAR(255),
    total_bookings INT DEFAULT 0,
    cancellation_count INT DEFAULT 0,
    is_blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_toto_customer_phone UNIQUE (account_id, phone_number)
);

-- 3. Toto Pricing Configuration
CREATE TABLE IF NOT EXISTS public.toto_pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    base_fare NUMERIC(10, 2) DEFAULT 20.00,
    base_distance_km NUMERIC(10, 2) DEFAULT 1.00,
    rate_per_km NUMERIC(10, 2) DEFAULT 15.00,
    minimum_fare NUMERIC(10, 2) DEFAULT 20.00,
    tech_support_fee NUMERIC(10, 2) DEFAULT 5.00,
    platform_commission_percent NUMERIC(5, 2) DEFAULT 5.00,
    night_charge_multiplier NUMERIC(4, 2) DEFAULT 1.25,
    night_start_time TIME DEFAULT '22:00:00',
    night_end_time TIME DEFAULT '06:00:00',
    helpline_phone VARCHAR(30) DEFAULT '8348122122',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_toto_pricing_account UNIQUE (account_id)
);

-- 4. Toto Dynamic Message & Legal Templates (Bengali Defaults)
CREATE TABLE IF NOT EXISTS public.toto_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    driver_terms_title TEXT DEFAULT '“ সুন্দরবন রাইডার “ চালক নিবন্ধন ও ঘোষণা (Driver Terms & Agreement)',
    driver_terms_body TEXT DEFAULT '১. স্বাধীন পরিষেবা প্রদানকারী (Independent Service Provider)\n২. দায়বদ্ধতা বর্জন (No-Liability Disclaimer)\n৩. নিরাপত্তা ও আইন মান্য করা (Safety & Compliance)\n৪. যাত্রী সংক্রান্ত আচরণ (Passenger Conduct)\n৫. প্রযুক্তিগত সহায়তা ফি (Platform Tech Fee)\n৬. আইনি সুরক্ষা ও সহযোগিতার সম্মতি\n৭. ঘোষণা (Declaration): সমস্ত শর্ত মেনে স্বেচ্ছায় যুক্ত হচ্ছি।',
    customer_disclaimer_header TEXT DEFAULT 'বিশেষ দ্রষ্টব্য: ভার্চুয়াল ডিসক্লেইমার ও শর্তাবলী',
    customer_disclaimer_body TEXT DEFAULT '"সুন্দরবন রাইডার" একটি নিবন্ধিত আইটি এবং আইটিইএস প্ল্যাটফর্ম। এটি চালক ও কাস্টমারদের মধ্যে সরাসরি যোগাযোগের মাধ্যম হিসেবে কাজ করে। যাতায়াতের সময় মালামাল বা ক্ষয়ক্ষতির জন্য প্ল্যাটফর্ম দায়ী থাকবে না। নির্ধারিত রেট চার্ট অনুযায়ী ভাড়া প্রযোজ্য।',
    confirmation_bilingual TEXT DEFAULT '✨ বুকিং নিশ্চিত হয়েছে ✨\n🆔 বুকিং নং : * {BOOKING_NO} *\n📞 চালক নং : {DRIVER_PHONE}\n📞 হেল্পলাইন : {HELPLINE}\n🙏 সুন্দরবন রাইডার-এর সাথে থাকার জন্য ধন্যবাদ। যাত্রা নিরাপদ হোক !',
    cancellation_warning TEXT DEFAULT '⚠️ 🚫 গুরুত্বপূর্ণ তথ্য 🚫 ⚠️\nপ্রিয় গ্রাহক,\n❌ ৩ বারের বেশি বুকিং বাতিল করলে আপনার এই নম্বর থেকে বুকিং স্থগিত করা হবে।\n✅ বুকিং পরিষেবা সচল রাখতে নিশ্চিত হয়ে বুক করুন।\n❤️ — সুন্দরবন রাইডার — ❤️',
    helpline_number VARCHAR(30) DEFAULT '8348122122',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_toto_template_account UNIQUE (account_id)
);

-- 5. Toto Bookings Table (Active and Historical Trips)
CREATE TABLE IF NOT EXISTS public.toto_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    booking_ref VARCHAR(20) NOT NULL,
    customer_id UUID REFERENCES public.toto_customers(id) ON DELETE SET NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_name VARCHAR(255),
    rider_id UUID REFERENCES public.toto_riders(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',
        'awaiting_disclaimer',
        'searching_drivers',
        'driver_assigned',
        'arrived_pickup',
        'in_progress',
        'completed',
        'cancelled_customer',
        'cancelled_driver'
    )),
    pickup_name TEXT,
    pickup_lat DOUBLE PRECISION,
    pickup_lng DOUBLE PRECISION,
    drop_name TEXT,
    drop_lat DOUBLE PRECISION,
    drop_lng DOUBLE PRECISION,
    estimated_distance_km NUMERIC(10, 2) DEFAULT 0,
    estimated_duration_mins INT DEFAULT 0,
    estimated_fare NUMERIC(10, 2) DEFAULT 0,
    final_fare NUMERIC(10, 2) DEFAULT 0,
    tech_fee NUMERIC(10, 2) DEFAULT 0,
    rider_earnings NUMERIC(10, 2) DEFAULT 0,
    payment_status VARCHAR(30) DEFAULT 'pending',
    payment_method VARCHAR(30) DEFAULT 'cash',
    disclaimer_accepted_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by VARCHAR(50),
    dispatched_rider_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 6. Toto Reviews & Ratings
CREATE TABLE IF NOT EXISTS public.toto_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.toto_bookings(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES public.toto_riders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.toto_customers(id) ON DELETE SET NULL,
    rating_stars INT NOT NULL CHECK (rating_stars >= 1 AND rating_stars <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_toto_review_booking UNIQUE (booking_id)
);

-- 7. Toto Second-by-Second Audit Logs
CREATE TABLE IF NOT EXISTS public.toto_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.toto_bookings(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    actor_type VARCHAR(50) NOT NULL, -- 'customer', 'rider', 'system', 'admin'
    actor_id VARCHAR(255),
    details TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning fast queries & Realtime subscriptions
CREATE INDEX IF NOT EXISTS idx_toto_riders_status ON public.toto_riders(account_id, duty_status, is_approved);
CREATE INDEX IF NOT EXISTS idx_toto_bookings_status ON public.toto_bookings(account_id, status);
CREATE INDEX IF NOT EXISTS idx_toto_bookings_ref ON public.toto_bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_toto_audit_created ON public.toto_audit_logs(account_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.toto_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toto_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Authenticated Account Members
CREATE POLICY "Account members can access toto_riders"
    ON public.toto_riders FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_customers"
    ON public.toto_customers FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_pricing_config"
    ON public.toto_pricing_config FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_templates"
    ON public.toto_templates FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_bookings"
    ON public.toto_bookings FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_reviews"
    ON public.toto_reviews FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

CREATE POLICY "Account members can access toto_audit_logs"
    ON public.toto_audit_logs FOR ALL TO authenticated
    USING (account_id IN (SELECT account_id FROM public.account_members WHERE user_id = auth.uid()));

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.toto_riders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.toto_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.toto_audit_logs;
