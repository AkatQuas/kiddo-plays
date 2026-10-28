from datasets import load_dataset

gigaspeech = load_dataset("speechcolab/gigaspeech", "xs", streaming=True)
gigaspeech_head = gigaspeech["train"].take(2)
print(list(gigaspeech_head))
