"""
TalentIQ Results Plotting Script
Reads experiments/results.json and creates fig_ndcg.pdf and fig_latency.pdf
in the target output directory according to IEEE formatting guidelines.
"""

import sys
import os
import json
import matplotlib.pyplot as plt
import numpy as np

def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/plot_results.py <results_json_path> <output_dir>")
        sys.exit(1)

    results_path = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(results_path):
        print(f"Error: {results_path} not found.")
        sys.exit(1)

    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Plot NDCG@K
    if "ndcg_at_k" in data:
        ndcg_data = data["ndcg_at_k"]
        k_values = ndcg_data.get("K", [1, 3, 5, 10])
        
        plt.figure(figsize=(6, 4))
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
        
        markers = {"TF-IDF": "s", "BGE-Small": "^", "TalentIQ": "o"}
        colors = {"TF-IDF": "#4A5568", "BGE-Small": "#2B6CB0", "TalentIQ": "#C53030"}

        has_any_ndcg = False
        for method in ["TF-IDF", "BGE-Small", "TalentIQ"]:
            if method in ndcg_data and ndcg_data[method] is not None:
                scores = ndcg_data[method]
                has_any_ndcg = True
                plt.plot(
                    k_values, 
                    scores, 
                    marker=markers.get(method, "o"), 
                    color=colors.get(method, "#000000"),
                    linewidth=2, 
                    markersize=6, 
                    label=method
                )

        if not has_any_ndcg:
            plt.text(
                0.5, 0.5, 
                "NDCG@K Pending Human Relevance Labels\n(experiments/labelling_sheet.csv)", 
                ha="center", va="center", fontsize=11, color="#718096",
                transform=plt.gca().transAxes,
                bbox=dict(boxstyle="round,pad=0.5", facecolor="#EDF2F7", edgecolor="#CBD5E0")
            )

        plt.title("Ranking Quality Across Cutoffs (NDCG@K)", fontsize=12, fontweight="bold")
        plt.xlabel("Cutoff K", fontsize=11)
        plt.ylabel("NDCG", fontsize=11)
        plt.xticks(k_values)
        plt.ylim(0.0, 1.05)
        if has_any_ndcg:
            plt.legend(loc="lower right", frameon=True)
        plt.tight_layout()
        
        ndcg_pdf_path = os.path.join(output_dir, "fig_ndcg.pdf")
        plt.savefig(ndcg_pdf_path, format="pdf", dpi=300)
        plt.close()
        print(f"Successfully generated: {ndcg_pdf_path}")

    # 2. Plot Latency
    if "latency_ms" in data:
        lat_data = data["latency_ms"]
        labels = list(lat_data.keys())
        values = [lat_data[k] for k in labels]

        plt.figure(figsize=(6, 4))
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

        x = np.arange(len(labels))
        bars = plt.bar(x, values, color=["#4A5568", "#2B6CB0", "#C53030"], width=0.5)

        for bar in bars:
            height = bar.get_height()
            plt.annotate(
                f"{height:.1f} ms",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center", va="bottom",
                fontsize=9
            )

        plt.title("Execution Latency Benchmark (ms)", fontsize=12, fontweight="bold")
        plt.ylabel("Latency (ms)", fontsize=11)
        plt.xticks(x, labels, rotation=15, ha="right", fontsize=9)
        plt.tight_layout()

        latency_pdf_path = os.path.join(output_dir, "fig_latency.pdf")
        plt.savefig(latency_pdf_path, format="pdf", dpi=300)
        plt.close()
        print(f"Successfully generated: {latency_pdf_path}")

if __name__ == "__main__":
    main()
