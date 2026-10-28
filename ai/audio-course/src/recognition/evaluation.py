from evaluate import load
from transformers.models.whisper.english_normalizer import BasicTextNormalizer

reference = "the cat sat on the mat"
prediction = "the cat sit on the"

wer_metric = load("wer")

wer = wer_metric.compute(references=[reference], predictions=[prediction])

print(wer)

###

normalizer = BasicTextNormalizer()

prediction = " He tells us that at this festive season of the year, with Christmas and roast beef looming before us, similarly is drawn from eating and its results occur most readily to the mind."
normalized_prediction = normalizer(prediction)

print(normalized_prediction)

reference = "HE TELLS US THAT AT THIS FESTIVE SEASON OF THE YEAR WITH CHRISTMAS AND ROAST BEEF LOOMING BEFORE US SIMILES DRAWN FROM EATING AND ITS RESULTS OCCUR MOST READILY TO THE MIND"
normalized_reference = normalizer(reference)

wer = wer_metric.compute(
    references=[normalized_reference], predictions=[normalized_prediction]
)
print(wer)
