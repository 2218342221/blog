"""A deterministic CPU classification exercise. Requires Python 3.10+ and PyTorch 2.6+.

Run: python training_recipe.py --epochs 5
Resume: python training_recipe.py --epochs 8 --resume checkpoint.pt
Only load trusted checkpoints created by this script. No dataset download is needed.
"""
import argparse
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=5, help="total target epochs")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--checkpoint", type=Path, default=Path("checkpoint.pt"))
    args = parser.parse_args()
    if args.epochs < 1:
        parser.error("--epochs must be positive")

    # CPU-only by design: this exercise isolates training and resume semantics.
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    restored = None
    if args.resume:
        restored = torch.load(args.resume, map_location="cpu", weights_only=True)
        if restored.get("format_version") != 1:
            raise ValueError("Unsupported checkpoint format")
        args.seed = restored["seed"]
    torch.manual_seed(args.seed)

    # Data RNG is separate from model/dropout RNG and loader shuffle RNG.
    data_rng = torch.Generator().manual_seed(args.seed + 1)
    x = torch.randn(1200, 16, generator=data_rng)
    direction = torch.linspace(-1, 1, 16)
    noise = 0.2 * torch.randn(1200, generator=data_rng)
    y = ((x @ direction + noise) > 0).long()
    order = torch.randperm(len(x), generator=data_rng)
    train_ids, valid_ids = order[:960], order[960:]
    mean = x[train_ids].mean(0)
    std = x[train_ids].std(0).clamp_min(1e-6)
    if restored:
        mean, std = restored["mean"], restored["std"]
    x = (x - mean) / std
    train_data = TensorDataset(x[train_ids], y[train_ids])
    valid_data = TensorDataset(x[valid_ids], y[valid_ids])
    loader_rng = torch.Generator().manual_seed(args.seed + 2)
    train_loader = DataLoader(train_data, batch_size=64, shuffle=True,
                              generator=loader_rng, num_workers=0)
    valid_loader = DataLoader(valid_data, batch_size=64, shuffle=False,
                              num_workers=0)

    model = nn.Sequential(nn.Linear(16, 64), nn.ReLU(), nn.Dropout(0.1),
                          nn.Linear(64, 2))
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3, weight_decay=1e-3)
    start_epoch = 0
    if restored:
        model.load_state_dict(restored["model"])
        optimizer.load_state_dict(restored["optimizer"])
        loader_rng.set_state(restored["loader_rng"])
        torch.set_rng_state(restored["torch_rng"])
        start_epoch = restored["next_epoch"]
        print(f"Resuming at epoch {start_epoch + 1}; target {args.epochs}")

    for epoch in range(start_epoch, args.epochs):
        model.train()
        loss_sum, train_count = 0.0, 0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(batch_x)
            loss = nn.functional.cross_entropy(logits, batch_y)
            if not torch.isfinite(loss):
                raise RuntimeError("Non-finite loss; inspect inputs and model")
            loss.backward()
            optimizer.step()
            loss_sum += loss.detach().item() * len(batch_y)
            train_count += len(batch_y)

        model.eval()
        valid_loss, correct, valid_count = 0.0, 0, 0
        with torch.inference_mode():
            for batch_x, batch_y in valid_loader:
                logits = model(batch_x)
                valid_loss += nn.functional.cross_entropy(
                    logits, batch_y, reduction="sum").item()
                correct += (logits.argmax(-1) == batch_y).sum().item()
                valid_count += len(batch_y)
        print(f"epoch={epoch + 1:02d} train_loss={loss_sum / train_count:.4f} "
              f"valid_loss={valid_loss / valid_count:.4f} "
              f"valid_accuracy={correct / valid_count:.2%}")

        payload = {
            "format_version": 1, "seed": args.seed, "next_epoch": epoch + 1,
            "model": model.state_dict(), "optimizer": optimizer.state_dict(),
            "torch_rng": torch.get_rng_state(), "loader_rng": loader_rng.get_state(),
            "mean": mean, "std": std,
        }
        args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.checkpoint.with_name(args.checkpoint.name + ".tmp")
        torch.save(payload, temporary)
        temporary.replace(args.checkpoint)

    print(f"Checkpoint: {args.checkpoint.resolve()}")


if __name__ == "__main__":
    main()
