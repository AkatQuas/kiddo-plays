// Mock Tools: Simulate tool behavior for testing

export const mockTools = {
  calculator: (params: { a: number; b: number }) => {
    return { result: params.a + params.b };
  },
  translator: (params: { text: string; language: string }) => {
    return { translatedText: `${params.text} in ${params.language}` };
  },
};
