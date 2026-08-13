-- EU AI Act — Human-in-the-loop + transparentność AI na daily_logs (HLD §D / Art. 50 + oversight)

ALTER TABLE public.daily_logs
  ADD COLUMN is_ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN approved_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.daily_logs.is_ai_generated IS
  'EU AI Act: oznaczenie treści wygenerowanej przez AI (transparentność / Art. 50) przed prezentacją użytkownikowi.';

COMMENT ON COLUMN public.daily_logs.approved_by_user_id IS
  'EU AI Act: Human-in-the-loop — ID personelu zatwierdzającego treść przed wysłaniem Peace Letter do rodziny.';

CREATE INDEX daily_logs_approved_by_user_id_idx
  ON public.daily_logs (approved_by_user_id)
  WHERE approved_by_user_id IS NOT NULL;

CREATE INDEX daily_logs_is_ai_generated_idx
  ON public.daily_logs (is_ai_generated)
  WHERE is_ai_generated = true;
