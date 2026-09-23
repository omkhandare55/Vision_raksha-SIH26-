import os
import logging
import torch

if os.getenv("RENDER") or True:
    torch.set_num_threads(1)
else:
    torch.set_num_threads(2)

print("Torch imported and threads set.")

def test():
    print("Importing pipeline...")
    from ai.pipeline import init_pipeline
    print("Pipeline imported!")

test()
