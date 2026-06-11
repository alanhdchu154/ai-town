# Paper analysis summary

## A. Soul-uniqueness markers

- **emotional_expression_uniqueness**: mean 0.875 (95% CI 0.781-0.969, n=8).
- **comfort_style_uniqueness**: mean 0.688 (95% CI 0.562-0.875, n=8).
- **burden_response_uniqueness**: mean 0.688 (95% CI 0.562-0.875, n=8).
- **rule_based_aftertaste_proxy**: mean 0.876 (95% CI 0.752-0.959, n=8).
- **echo_similarity_penalty**: mean 0.044 (95% CI 0.014-0.078, n=8).
- **stage_direction_leak_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **attention_shift**: mean 0.438 (95% CI 0.338-0.544, n=8).
- **behavior_signal**: mean 0.562 (95% CI 0.312-0.812, n=8).
- **echo_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **emotion_behavior_link**: mean 0.755 (95% CI 0.695-0.806, n=8).
- **emotion_tone_link**: mean 0.731 (95% CI 0.622-0.830, n=8).
- **emotional_slogan_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **greeting_boilerplate_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **ichinose_debt**: mean 0.750 (95% CI 0.562-0.938, n=8).
- **imperfect_response_style**: mean 0.709 (95% CI 0.540-0.876, n=8).
- **indirectness**: mean 0.220 (95% CI 0.074-0.395, n=8).
- **lifecycle_flow**: mean 0.837 (95% CI 0.740-0.948, n=8).
- **memory_continuity**: mean 0.579 (95% CI 0.506-0.681, n=8).
- **memory_residue**: mean 0.812 (95% CI 0.625-0.938, n=8).
- **other_awareness**: mean 0.812 (95% CI 0.625-0.938, n=8).
- **over_articulation_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **over_labeling_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **over_system_penalty**: mean 0.062 (95% CI 0.000-0.188, n=8).
- **private_self**: mean 0.375 (95% CI 0.188-0.625, n=8).
- **relationship_residue**: mean 0.856 (95% CI 0.769-0.900, n=8).
- **role_escape_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **template_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **therapy_empathy_penalty**: mean 0.000 (95% CI 0.000-0.000, n=8).
- **tianze_pressure**: mean 0.625 (95% CI 0.500-0.812, n=8).
- **umi_alan_anchor**: mean 0.562 (95% CI 0.500-0.688, n=8).

## B. Residue ablation

- residue_on rolling-callback rate 0.250 vs residue_off nan (risk diff +nan, 95% CI nan-nan, permutation p=nan).
- rule-based aftertaste proxy mean 0.876 (on) vs nan (off); Cliff's delta +nan, diff 95% CI nan-nan, permutation p=nan.
- Observed direction: residue_on <= residue_off.

## C. Annotation agreement & convergent validity

- Convergent validity (Spearman, `rule_based_aftertaste_proxy` vs human `emotional_binding`): not computable (insufficient overlap/variance).

## D. Figures

- results/figures/marker_means.png
- results/figures/residue_ablation.png
