# B. Residue ablation (residue_on vs residue_off)

n(residue_on)=8, n(residue_off)=0.
Permutation test: 10000 permutations, seed=1234, two-sided.
Bootstrap difference CI: 10000 resamples.

For the continuous secondary outcome the effect is Cliff's delta;
for the binary primary outcome the effect is the risk difference.
The difference CIs use the two-sample bootstrap on the mean.

| outcome | residue_on | residue_off | effect | effect_type | ci_lo | ci_hi | perm_p |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rolling_callback_rate (primary) | 0.2500 |  |  | risk_difference |  |  |  |
| rule_based_aftertaste_proxy (secondary) | 0.8762 |  |  | cliffs_delta |  |  |  |
