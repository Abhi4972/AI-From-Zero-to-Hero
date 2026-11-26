# Lessons that pass tensors between processes need file-system sharing in this build sandbox
# (descriptor passing over Unix sockets is not available here).
try:
    import torch.multiprocessing as _tmp
    _tmp.set_sharing_strategy("file_system")
except Exception:
    pass
