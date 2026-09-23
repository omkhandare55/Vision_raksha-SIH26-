import torch

with open("fake_lfs.pth", "w") as f:
    f.write("version https://git-lfs.github.com/spec/v1\n")
    f.write("oid sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n")
    f.write("size 114367099\n")

try:
    torch.load("fake_lfs.pth")
except Exception as e:
    print(f"Exception raised: {type(e).__name__}: {e}")
