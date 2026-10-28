# Glossary

Names used by the scheduler. Architecture words (module, interface, seam, adapter) are the codebase-design vocabulary and are not redefined here.

**Job**: one image-to-image request. Identified by `job_id`. Carries a prompt, an input image URL, generation parameters, an attempt count, and eventually a result reference or an error.

**JobSpec**: the immutable request half of a Job. What the caller submitted.

**JobRecord**: a Job plus status (`waiting`, `running`, `finished`, `failed`).

**JobBoard**: the module that stores every Job and hands each one to a single worker. Production adapter is Redis. There is no in-pod queue.

**Claim**: taking a waiting Job so no other pod will run it. A claim expires after the visibility window; the board then retries or fails it.

**Result reference**: the string a client polls for. An S3 presigned URL, or an absolute path when storage is the pod-local adapter.

**ImageEngine**: the module that turns a claimed Job into image bytes. The production adapter is HTTP to a process outside this pod. This project does not load model weights.

**ObjectStore**: the module that publishes those bytes. Adapters: S3, or a directory on this pod.

**Scheduler**: the module that claims a Job, calls the ImageEngine, puts the bytes in the ObjectStore, then acks, retries, or fails the Job. One pod runs several worker loops; many pods share one JobBoard.
