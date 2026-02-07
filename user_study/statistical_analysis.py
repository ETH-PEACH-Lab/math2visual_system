import pandas as pd
import numpy as np
from scipy import stats
from scipy.stats import shapiro, wilcoxon
from scipy.special import gamma
import matplotlib.pyplot as plt
import seaborn as sns

def cohens_d_paired(data1, data2, hedges_correction=True):
    """
    Calculate Cohen's d_av (averaged) for paired samples.
    
    This is the recommended formula for paired designs as it can be 
    compared directly to Cohen's d from independent samples.
    
    Formula: d_av = (mean1 - mean2) / ((SD1 + SD2) / 2)
    
    If hedges_correction=True, applies Hedges' g correction for small sample bias:
    g = d * J, where J = Γ(df/2) / (√(df/2) * Γ((df-1)/2))
    
    For paired samples: df = n - 1 (where n is number of pairs)
    For independent samples: df = n1 + n2 - 2
    
    References:
    - Lakens (2013), Calculating and reporting effect sizes
    - Hedges (1981), Distribution theory for Glass's estimator
    - Borenstein et al. (2009), Introduction to Meta-Analysis, Ch. 4
    """
    n = len(data1)
    mean_diff = np.mean(data1) - np.mean(data2)
    sd1 = np.std(data1, ddof=1)
    sd2 = np.std(data2, ddof=1)
    mean_sd = (sd1 + sd2) / 2
    d = mean_diff / mean_sd
    
    if hedges_correction:
        # Hedges' correction for small sample bias (exact formula)
        # For paired samples: df = n - 1
        df = n - 1
        J = gamma(df / 2) / (np.sqrt(df / 2) * gamma((df - 1) / 2))
        return d * J
    else:
        return d

def cohens_d_z(diff):
    """
    Calculate Cohen's d_z for paired samples (alternative formula).
    
    This divides mean difference by SD of differences.
    Note: This tends to overestimate effect size when r > 0.5.
    Included for comparison purposes only.
    """
    return np.mean(diff) / np.std(diff, ddof=1)

def wilcoxon_effect_size_rb(differences):
    """
    Calculate rank-biserial correlation for Wilcoxon signed-rank test.
    
    The rank-biserial correlation is the direct effect size measure for the
    Wilcoxon signed-rank test. It represents the dominance of one condition
    over another based on the ranks of the differences.
    
    Formula (Tomczak & Tomczak, 2014):
    r = 4|T - (R₁ + R₂)/2| / (n(n+1))
    
    where:
    - R₁ = sum of ranks with positive signs (sum of ranks of positive values)
    - R₂ = sum of ranks with negative signs (sum of ranks of negative values)
    - T = the smaller of the two values (R₁ or R₂), i.e., the Wilcoxon statistic
    - n = the total sample size (number of non-zero differences)
    
    Note: This formula calculates the magnitude (absolute value) of the effect size.
    
    This effect size is directly derived from the Wilcoxon statistic itself,
    unlike Rosenthal's r which converts from a z-statistic. The rank-biserial
    correlation is specifically designed for ranked data and provides a more
    interpretable measure of effect.
    
    Parameters
    ----------
    differences : array-like
        The paired differences (data1 - data2)
    
    Returns
    -------
    float
        Rank-biserial correlation (r_rb)
    
    Interpretation:
    - r_rb ranges from 0 to +1 (magnitude only)
    - 0 indicates no difference between conditions
    - Larger values indicate stronger effect (regardless of direction)
    - r_rb = 0.10-0.30: small effect
    - r_rb = 0.30-0.50: medium effect
    - r_rb ≥ 0.50: large effect
    
    The value represents the proportion of dominance:
    - r_rb = 0.7 means 70% of pairs favor one direction, 30% the other
    
    References:
    - Tomczak, M., & Tomczak, E. (2014). The need to report effect size 
      estimates revisited. An overview of some recommended measures of effect 
      size. Trends in Sport Sciences, 1(21), 19-25.
    - Kerby, D. S. (2014). The simple difference formula: An approach to 
      teaching nonparametric correlation. Comprehensive Psychology, 3, 11.IT.3.1
    """
    # Remove zero differences (they don't contribute to Wilcoxon test)
    nonzero_diffs = differences[differences != 0]
    
    if len(nonzero_diffs) == 0:
        return 0.0
    
    # Rank the absolute differences
    abs_diffs = np.abs(nonzero_diffs)
    ranks = stats.rankdata(abs_diffs)
    
    # Calculate sum of ranks for positive and negative differences
    R1 = np.sum(ranks[nonzero_diffs > 0])  # Sum of ranks with positive signs
    R2 = np.sum(ranks[nonzero_diffs < 0])  # Sum of ranks with negative signs
    
    # Total number of non-zero differences
    n = len(nonzero_diffs)
    
    # T = the smaller of the two rank sums (Wilcoxon statistic)
    T = min(R1, R2)
    
    # Calculate rank-biserial correlation using Tomczak & Tomczak (2014) formula:
    # r = 4|T - (R₁ + R₂)/2| / (n(n+1))
    r = 4 * abs(T - (R1 + R2) / 2) / (n * (n + 1))
    
    # Add sign to indicate direction: positive if R1 > R2 (more positive differences)
    # negative if R1 < R2 (more negative differences)
    sign = 1 if R1 > R2 else -1
    r = sign * r
    
    return r

def create_visualizations(df, variables, method_pairs):
    """Create box plots for all variables across methods"""
    # Set larger font sizes for all plot elements
    plt.rcParams.update({
        'font.size': 14,           # Base font size
        'axes.titlesize': 18,      # Title font size
        'axes.labelsize': 16,      # X and Y label font size
        'xtick.labelsize': 14,     # X tick label font size
        'ytick.labelsize': 14,     # Y tick label font size
        'legend.fontsize': 14,     # Legend font size
        'figure.titlesize': 20     # Figure title font size
    })
    
    n_vars = len(variables)
    n_cols = 3
    n_rows = (n_vars + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 5*n_rows))
    axes = axes.flatten()
    
    # Define colors for each method
    colors = ['lightblue', 'lightgreen', 'lightcoral']
    palette = dict(zip(['ChatGPT', 'Math2Visual', 'Custom'], colors))
    
    for idx, var in enumerate(variables):
        ax = axes[idx]
        
        # Create box plot
        sns.boxplot(data=df, x='method', y=var, ax=ax, 
                   order=['ChatGPT', 'Math2Visual', 'Custom'],
                   palette=palette)
        
        ax.set_xlabel('')
        ax.set_ylabel('Score' if var != 'task_completion_time' else 'Seconds')
        ax.set_title(var.replace('_', ' ').title())
        ax.grid(True, alpha=0.3, axis='y')
    
    # Hide extra subplots
    for idx in range(n_vars, len(axes)):
        axes[idx].set_visible(False)
    
    plt.tight_layout()
    plt.savefig('analysis_plots.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Reset to default font sizes
    plt.rcParams.update(plt.rcParamsDefault)
    
    print("  Plots saved to 'analysis_plots.png'")

# Load data
print("="*80)
print("STATISTICAL ANALYSIS OF USER STUDY DATA")
print("="*80)
print("\nLoading data from 'study_data.csv'...")
df = pd.read_csv('study_data.csv')
print(f"  Data loaded: {len(df)} rows, {len(df.columns)} columns")
print(f"  Participants: {df['participant'].nunique()}")
print(f"  Methods: {df['method'].unique()}")

# Define all variables to analyze
likert_vars = [
    'ease_of_use', 
    'intuitive', 
    'time_investment',  # reverse-scored
    'effort',  # reverse-scored
    'iterative_refinement', 
    'accuracy', 
    'educational_value', 
    'future_use'
]

continuous_vars = ['task_completion_time']

all_vars = likert_vars + continuous_vars

# Define method pairs for comparison
method_pairs = [
    ('ChatGPT', 'Math2Visual'),
    ('ChatGPT', 'Custom'),
    ('Math2Visual', 'Custom')
]

# Bonferroni correction: 
# Number of comparisons = number of variables × number of method pairs
# = 9 variables × 3 method pairs = 27 comparisons
alpha = 0.05
n_comparisons = len(all_vars) * len(method_pairs)
bonferroni_alpha = alpha / n_comparisons

print(f"\n{'='*80}")
print("BONFERRONI CORRECTION SETUP")
print(f"{'='*80}")
print(f"  Original alpha: {alpha}")
print(f"  Number of variables: {len(all_vars)}")
print(f"  Number of method pairs: {len(method_pairs)}")
print(f"  Total comparisons: {n_comparisons}")
print(f"  Bonferroni-corrected alpha: {bonferroni_alpha:.6f}")
print("="*80)

# Store results
results = []

# Iterate through all variables
for var in all_vars:
    print(f"\n{'='*80}")
    print(f"VARIABLE: {var}")
    print(f"{'='*80}\n")
    
    # Iterate through all method pairs
    for method1, method2 in method_pairs:
        print(f"\n{'-'*60}")
        print(f"Comparing {method1} vs {method2}")
        print(f"{'-'*60}")
        
        # Extract data for the two methods
        data1 = df[df['method'] == method1][var].values
        data2 = df[df['method'] == method2][var].values
        
        # Calculate differences (for paired design)
        differences = data1 - data2
        
        # Descriptive statistics
        print(f"\nDescriptive Statistics:")
        print(f"  {method1}: Mean = {np.mean(data1):.2f}, SD = {np.std(data1, ddof=1):.2f}")
        print(f"  {method2}: Mean = {np.mean(data2):.2f}, SD = {np.std(data2, ddof=1):.2f}")
        print(f"  Mean difference: {np.mean(differences):.2f} (SD = {np.std(differences, ddof=1):.2f})")
        
        # STEP 1: Shapiro-Wilk test for normality on differences
        print(f"\nSTEP 1: Shapiro-Wilk Normality Test on Differences")
        stat_shapiro, p_shapiro = shapiro(differences)
        print(f"  Shapiro-Wilk statistic: {stat_shapiro:.4f}")
        print(f"  p-value: {p_shapiro:.4f}")
        
        # STEP 2: Choose and apply appropriate test
        if p_shapiro > 0.05:
            # Data is normally distributed - use paired t-test
            print(f"  → Differences are normally distributed (p > 0.05)")
            print(f"\nSTEP 2: Paired t-test")
            stat_test, p_test = stats.ttest_rel(data1, data2)
            test_used = "Paired t-test"
            effect_size = cohens_d_paired(data1, data2, hedges_correction=True)
            effect_size_name = "Hedges' g"
            print(f"  t-statistic: {stat_test:.4f}")
            print(f"  p-value: {p_test:.4f}")
            print(f"  Effect size (Hedges' g): {effect_size:.4f}")
        else:
            # Data is not normally distributed - use Wilcoxon signed-rank test
            print(f"  → Differences are NOT normally distributed (p ≤ 0.05)")
            print(f"\nSTEP 2: Wilcoxon Signed-Rank Test")
            result = wilcoxon(data1, data2)
            stat_test = result.statistic
            p_test = result.pvalue
            
            test_used = "Wilcoxon"
            # Calculate rank-biserial correlation (direct effect size for Wilcoxon)
            effect_size = wilcoxon_effect_size_rb(differences)
            effect_size_name = "rank-biserial r"
            print(f"  Wilcoxon statistic: {stat_test:.4f}")
            print(f"  p-value: {p_test:.4f}")
            print(f"  Rank-biserial correlation: {effect_size:.4f}")
        
        # STEP 3: Apply Bonferroni correction
        print(f"\nSTEP 3: Bonferroni Correction")
        print(f"  Original p-value: {p_test:.4f}")
        print(f"  Bonferroni-corrected alpha: {bonferroni_alpha:.6f}")
        
        # Determine significance
        if p_test < bonferroni_alpha:
            significance = "SIGNIFICANT"
            print(f"  → Result: {significance} ** (p < {bonferroni_alpha:.6f})")
        else:
            significance = "NOT significant"
            print(f"  → Result: {significance} (p ≥ {bonferroni_alpha:.6f})")
        
        # Store results
        results.append({
            'Variable': var,
            'Comparison': f"{method1} vs {method2}",
            f'{method1}_Mean': np.mean(data1),
            f'{method1}_SD': np.std(data1, ddof=1),
            f'{method2}_Mean': np.mean(data2),
            f'{method2}_SD': np.std(data2, ddof=1),
            'Mean_Difference': np.mean(differences),
            'Diff_SD': np.std(differences, ddof=1),
            'Shapiro_W': stat_shapiro,
            'Shapiro_p': p_shapiro,
            'Test_Used': test_used,
            'Test_Statistic': stat_test,
            'p_value': p_test,
            'Effect_Size': effect_size,
            'Effect_Size_Type': effect_size_name,
            'Bonferroni_alpha': bonferroni_alpha,
            'Significant': significance
        })

# Create results dataframe
results_df = pd.DataFrame(results)

# Save results to CSV
results_df.to_csv('statistical_results.csv', index=False)
print("\n" + "="*80)
print("ANALYSIS COMPLETE")
print("="*80)
print(f"\nResults saved to 'statistical_results.csv'")

# Summary of significant findings
print("\n" + "="*80)
print("SUMMARY OF SIGNIFICANT FINDINGS (after Bonferroni correction)")
print("="*80)
significant_results = results_df[results_df['Significant'] == 'SIGNIFICANT']
if len(significant_results) > 0:
    print(f"\nFound {len(significant_results)} significant difference(s):\n")
    for idx, row in significant_results.iterrows():
        print(f"Variable: {row['Variable']}")
        print(f"  Comparison: {row['Comparison']}")
        print(f"  Mean difference: {row['Mean_Difference']:.2f}")
        print(f"  Test: {row['Test_Used']}")
        print(f"  p-value: {row['p_value']:.4f}")
        print(f"  Effect size ({row['Effect_Size_Type']}): {row['Effect_Size']:.4f}")
        print()
else:
    print("\nNo significant differences found after Bonferroni correction.")
    print("\nNote: With a very conservative correction (α = 0.00185) and small sample")
    print("size (n = 5), statistical power is limited. Consider examining effect sizes")
    print("and trends for practical significance.")

# Summary statistics by method
print("\n" + "="*80)
print("SUMMARY STATISTICS BY METHOD")
print("="*80)
for var in all_vars:
    print(f"\n{var}:")
    for method in ['ChatGPT', 'Math2Visual', 'Custom']:
        data = df[df['method'] == method][var].values
        print(f"  {method:15s}: M = {np.mean(data):.2f}, SD = {np.std(data, ddof=1):.2f}")

# Create visualizations
print("\n" + "="*80)
print("GENERATING VISUALIZATIONS")
print("="*80)
create_visualizations(df, all_vars, method_pairs)

print("\n" + "="*80)
print("ALL ANALYSIS COMPLETE")
print("="*80)
print("\nGenerated files:")
print("  1. statistical_results.csv - Complete statistical results")
print("  2. analysis_plots.png - Visualization of all variables")
print("\nNext steps:")
print("  - Review the results in statistical_results.csv")
print("  - Examine the visualizations in analysis_plots.png")
print("  - Report significant findings")
print("  - Discuss effect sizes and practical significance")
print("="*80)