# Anonymization

**Diffix Dashboards** relies on its [**`pg_diffix`** component](https://github.com/diffix/pg_diffix) (a PostgreSQL extension) to
anonymize data, which uses **Diffix Fir** as its underlying anonymization mechanism. Prior versions of **Diffix** were developed
by the **Max Planck Institute for Software Systems (MPI-SWS)** and **Aircloak GmbH**. **Diffix Fir** is developed by **MPI-SWS**
and the **[Open Diffix project](https://open-diffix.org)**. **Diffix Fir** is strong enough to satisfy the GDPR definition of
anonymization as non-personal data.

> This page gives an overview of **Diffix Fir**. The preceding version [Diffix Elm specification](https://arxiv.org/abs/2201.04351) provides a complete description, including a security analysis and guidance for making a risk assessment. If you would like help in getting approval from your **Data Protection Officer (DPO)** or **Data Protection Authority (DPA)**, please contact us at [feedback@open-diffix.org](mailto:feedback@open-diffix.org).

**Diffix Dashboards'** purpose is to allow anonymized analysis of data using Metabase, an easy to use Business Intelligence (BI) tool.
If you like **Diffix Dashboards** but you find it is missing some specific features your use case requires, please contact
us at [feedback@open-diffix.org](mailto:feedback@open-diffix.org).

## Disclaimer

Users of **Diffix Dashboards** are trusted: they have access to the original
data and are trusted to protect the original data.
**Diffix Dashboards** protects against _accidental_ release of personal
data. In other words, when used simply to provide useful data, and not
with an explicit and willful intent to generate a non-anonymous output,
the analysis results of **Diffix Dashboards** are anonymous. Having said that,
there are two types of output sequences that can lead to personal data
being released. [These are listed](#output-sequences-to-avoid) at the end of this section.

## Overview of basic mechanisms

**Diffix Fir** combines three common anonymization mechanisms:

- **Noise:** Distorts counts.
- **Suppression:** Removes outputs that pertain to too few protected entities.
- **Generalization:** Makes data more coarse-grained, for instance generalizing date-of-birth to year-of-birth.

Noise is commonly used with Differential Privacy mechanisms. Generalization and suppression are commonly used with k-anonymity.

**Diffix Fir** automatically applies these three mechanisms as needed on a query-by-query basis. **Diffix Fir** detects how much is contributed to each output bin by each protected entity, and tailors the amount of noise so as to maximize data quality while maintaining strong anonymization. The quality of data anonymized with **Diffix Fir** usually far exceeds that of Differential Privacy and k-anonymity.

## Proportional Noise

**Diffix Fir** adds pseudo-random noise taken from a normal distribution. The amount of noise (the standard deviation) is proportional to how much is contributed to the count by the heaviest contributors. When counting the number of protected entities (versus counting rows), each entity contributes 1, and the noise standard deviation is `SD=1.5`. With high probability, the resulting answer will be within plus or minus 5 of the true answer.

When counting the number of rows, the amount of noise is larger: proportional to the number of rows contributed by the highest contributors. This is similar to the concept of sensitivity in Differential Privacy. Proportional noise protects high contributors in the case where data recipients may have prior knowledge about the heavy contributors.

Finally, **Diffix Fir** removes the excess contributions of extreme outliers (one or two protected entities that contribute far more rows than other protected entities). This prevents data recipients from inferring information about extreme outliers from the amount of noise itself.

## Suppression

**Diffix Fir** recognizes how many protected entities contribute to each output bin. When the number is too small, **Diffix Fir** suppresses (doesn't output) the bin. This prevents data recipients from inferring information about individual protected entities even when the recipients have prior knowledge.

Rather than apply a single suppression threshold to all bins, **Diffix Fir** slightly modifies the threshold for different bins. This adds additional uncertainty for recipients that have prior knowledge of protected entities.

By default, **Diffix Fir** suppresses bins with fewer than 5 protected entities _on average_, corresponding to the `Suppression Threshold` anonymization parameter default value of 3. This can be configured at runtime (see section [Configure anonymization parameters](operation.md#configure-anonymization-parameters)). A minimum value of 2 for `Suppression Threshold` is enforced.

## Generalization

Unlike proportional noise and suppression, **Diffix Fir** does not automate and enforce generalization. This is because the amount of acceptable generalization depends on the analytic goals of each use case. For instance, in some cases year-of-birth may be required, whereas in others decade-of-birth may be acceptable. **Diffix Fir** has no way of knowing what level of generalization to choose. Rather, this is left to the analyst so that data quality can be tailored to the specific use case.

As a general rule, noise and suppression force analysts to generalize. If data is too fine-grained, then each output bin will have very few protected entities. In these cases, the bins may be suppressed, or if not suppressed the signal-to-noise may be too low.

## Output sequences to avoid

The following two output sequences must be avoided to ensure that the
analysis results of **Diffix Dashboards** are anonymous. Note that a user
acting as normal would have no reason to accidentally generate these output
sequences.

### Range increments

For numeric columns, the user must avoid a series of outputs where each
subsequent output modifies the generalization range by a tiny amount.
For instance, suppose there is a `salary` column. The user must avoid
a series of outputs where the generalization field is set to `1000.01`,
`1000.02`, `1000.03`, etc. Doing this would effectively allow the
receiver of the outputs to eliminate some of the noise through averaging and detect when
a protected entity with a known salary moves from one bin to another.

### Substring increments on columns with inherent randomness

Sometimes a text column may have some inherent randomness: for instance a
column containing UUID values. The user must avoid a sequence of outputs
where many of different substrings (10s of substrings) are specified.
For instance:

```
substring start 1, substring length 1
substring start 2, substring length 1
substring start 3, substring length 1
...
substring start 1, substring length 2
substring start 2, substring length 2
substring start 3, substring length 2
...
substring start 1, substring length 3
substring start 2, substring length 3
substring start 3, substring length 3
...
```
