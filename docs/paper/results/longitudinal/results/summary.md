# Paper analysis summary

## A. Soul-uniqueness markers

- **emotional_expression_uniqueness**: mean 0.938 (95% CI 0.812-1.000, n=4).
- **comfort_style_uniqueness**: mean 0.625 (95% CI 0.500-0.875, n=4).
- **burden_response_uniqueness**: mean 0.875 (95% CI 0.625-1.000, n=4).
- **rule_based_aftertaste_proxy**: mean 1.000 (95% CI 1.000-1.000, n=4).
- **echo_similarity_penalty**: mean 0.075 (95% CI 0.028-0.120, n=4).
- **stage_direction_leak_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **attention_shift**: mean 0.315 (95% CI 0.250-0.380, n=4).
- **behavior_signal**: mean 0.500 (95% CI 0.000-1.000, n=4).
- **echo_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **emotion_behavior_link**: mean 0.713 (95% CI 0.630-0.780, n=4).
- **emotion_tone_link**: mean 0.855 (95% CI 0.765-0.900, n=4).
- **emotional_slogan_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **greeting_boilerplate_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **ichinose_debt**: mean 0.500 (95% CI 0.500-0.500, n=4).
- **imperfect_response_style**: mean 0.917 (95% CI 0.752-1.000, n=4).
- **indirectness**: mean 0.700 (95% CI 0.700-0.700, n=4).
- **lifecycle_flow**: mean 0.915 (95% CI 0.785-0.980, n=4).
- **memory_continuity**: mean 0.500 (95% CI 0.500-0.500, n=4).
- **memory_residue**: mean 0.750 (95% CI 0.500-1.000, n=4).
- **other_awareness**: mean 1.000 (95% CI 1.000-1.000, n=4).
- **over_articulation_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **over_labeling_penalty**: mean 0.060 (95% CI 0.000-0.180, n=4).
- **over_system_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **private_self**: mean 0.750 (95% CI 0.500-1.000, n=4).
- **relationship_residue**: mean 0.812 (95% CI 0.637-0.900, n=4).
- **role_escape_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **template_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **therapy_empathy_penalty**: mean 0.000 (95% CI 0.000-0.000, n=4).
- **tianze_pressure**: mean 0.500 (95% CI 0.500-0.500, n=4).
- **umi_alan_anchor**: mean 0.750 (95% CI 0.500-1.000, n=4).

## B. Residue ablation

- residue_on rolling-callback rate 0.500 vs residue_off 0.000 (risk diff +0.500, 95% CI 0.000-1.000, permutation p=1.0000).
- rule-based aftertaste proxy mean 1.000 (on) vs 1.000 (off); Cliff's delta +0.000, diff 95% CI 0.000-0.000, permutation p=1.0000.
- Observed direction: residue_on > residue_off.

## C. Annotation agreement & convergent validity

- Convergent validity (Spearman, `rule_based_aftertaste_proxy` vs human `emotional_binding`): not computable (insufficient overlap/variance).

## D. Figures

- results/figures/marker_means.png
- results/figures/residue_ablation.png
