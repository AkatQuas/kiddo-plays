package com.example.catering.utils

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

class TtsUtil(private val context: Context) {
    private var tts: TextToSpeech? = null
    private var isInitialized = false

    fun init() {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.CHINA
                isInitialized = true
            }
        }
    }

    fun speak(text: String) {
        if (isInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
        }
    }

    fun destroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}