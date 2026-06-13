# B. Residue ablation (residue_on vs residue_off)

n(residue_on)=2, n(residue_off)=2.
Permutation test: 10000 permutations, seed=1234, two-sided.
Bootstrap difference CI: 10000 resamples.

For the continuous secondary outcome the effect is Cliff's delta;
for the binary primary outcome the effect is the risk difference.
The difference CIs use the two-sample bootstrap on the mean.

| outcome | residue_on | residue_off | effect | effect_type | ci_lo | ci_hi | perm_p |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rolling_callback_rate (primary) | 0.5000 | 0.0000 | 0.5000 | risk_difference | 0.0000 | 1.0000 | 1.0000 |
| rule_based_aftertaste_proxy (secondary) | 1.0000 | 1.0000 | 0.0000 | cliffs_delta | 0.0000 | 0.0000 | 1.0000 |
