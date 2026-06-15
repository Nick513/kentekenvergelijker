-- Rename comparison_specifications to specifications.

alter table public.comparison_specifications rename to specifications;

alter index public.comparison_specifications_group_sort_idx
  rename to specifications_group_sort_idx;

alter index public.comparison_specifications_active_idx
  rename to specifications_active_idx;

alter policy comparison_specifications_public_read
  on public.specifications
  rename to specifications_public_read;

alter table public.specifications
  rename constraint comparison_specifications_value_source_check
  to specifications_value_source_check;

alter table public.specifications
  rename constraint comparison_specifications_display_type_check
  to specifications_display_type_check;
