
-- ENUMS
create type public.payment_type as enum ('cartao_12x','cartao_recorrente','boleto_tmb');
create type public.tmb_status as enum ('em_dia','quitado','em_atraso','negativado','cancelado','reembolsado');
create type public.enrollment_manual_status as enum ('cancelado','reembolsado');
create type public.churn_status as enum ('solicitado','em_negociacao','revertido','concluido');
create type public.churn_reason as enum ('price','competitor','personal','no_engagement','other');

-- EXPERTS
create table public.experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null references public.experts(id) on delete cascade,
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.products(expert_id);

-- ENROLLMENTS
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  payment_type public.payment_type not null,
  purchase_date date not null,
  expiration_date date not null,
  last_payment_date date,
  tmb_status public.tmb_status,
  manual_status public.enrollment_manual_status,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.enrollments(product_id);
create index on public.enrollments(expiration_date);

-- STATUS HISTORY
create table public.enrollment_history (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index on public.enrollment_history(enrollment_id);

-- CHURN
create table public.churn_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text,
  reason_category public.churn_reason,
  status public.churn_status not null default 'solicitado',
  resolved_at timestamptz,
  notes text,
  handled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.churn_requests(enrollment_id);
create index on public.churn_requests(status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_enrollments_updated before update on public.enrollments
  for each row execute function public.set_updated_at();
create trigger trg_churn_updated before update on public.churn_requests
  for each row execute function public.set_updated_at();

-- Auto-cancel enrollment on churn concluido
create or replace function public.handle_churn_concluido()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'concluido' and (old.status is distinct from 'concluido') then
    update public.enrollments
      set manual_status = 'cancelado'
      where id = new.enrollment_id;
    if new.resolved_at is null then
      new.resolved_at = now();
    end if;
  end if;
  return new;
end; $$;
create trigger trg_churn_concluido before update on public.churn_requests
  for each row execute function public.handle_churn_concluido();

-- RLS: single admin role app, any authenticated user can manage all data
alter table public.experts enable row level security;
alter table public.products enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_history enable row level security;
alter table public.churn_requests enable row level security;

create policy "auth all experts" on public.experts for all to authenticated using (true) with check (true);
create policy "auth all products" on public.products for all to authenticated using (true) with check (true);
create policy "auth all enrollments" on public.enrollments for all to authenticated using (true) with check (true);
create policy "auth all enrollment_history" on public.enrollment_history for all to authenticated using (true) with check (true);
create policy "auth all churn" on public.churn_requests for all to authenticated using (true) with check (true);

-- Seed experts + products
insert into public.experts (id, name) values
  ('11111111-1111-1111-1111-111111111111','Charles França'),
  ('22222222-2222-2222-2222-222222222222','Jorge Penna');

insert into public.products (expert_id, name) values
  ('11111111-1111-1111-1111-111111111111','ACP 360°'),
  ('22222222-2222-2222-2222-222222222222','Formação Calculista Pro'),
  ('22222222-2222-2222-2222-222222222222','Pós-Graduação');
