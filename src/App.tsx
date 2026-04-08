import { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Copy, Check, Sparkles, Youtube, Loader2, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface GeneratedResult {
  title: string;
  descriptionEn: string;
  descriptionVi: string;
  keywords: string;
  isGenerating?: boolean;
  isPending?: boolean;
}

export default function App() {
  const [titlesInput, setTitlesInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const handleGenerate = async () => {
    const titles = titlesInput.split('\n').map((t) => t.trim()).filter((t) => t.length > 0);
    
    if (titles.length === 0) {
      setError('Vui lòng nhập ít nhất một tiêu đề video.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    // Khởi tạo danh sách kết quả trống cho tất cả tiêu đề
    const initialResults: GeneratedResult[] = titles.map(title => ({
      title,
      descriptionEn: '',
      descriptionVi: '',
      keywords: '',
      isGenerating: false,
      isPending: true
    }));
    setResults([...initialResults]);

    try {
      const BATCH_SIZE = 5;
      for (let i = 0; i < titles.length; i += BATCH_SIZE) {
        const batch = titles.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (title, batchIndex) => {
          const actualIndex = i + batchIndex;
          
          // Đánh dấu đang tạo cho video hiện tại
          setResults(prev => {
            const next = [...prev];
            next[actualIndex] = { ...next[actualIndex], isGenerating: true, isPending: false };
            return next;
          });

          const prompt = `Bạn là một chuyên gia SEO YouTube hàng đầu. Nhiệm vụ của bạn là viết phần mô tả (description) chuẩn SEO, hấp dẫn và thu hút cho video YouTube sau.
          
Tiêu đề video: "${title}"
Từ khóa bổ sung (nếu có): ${keywordsInput || 'Tự động suy luận từ khóa tốt nhất từ tiêu đề'}

Yêu cầu:
1. Mở đầu bằng một câu hook hấp dẫn.
2. Tóm tắt nội dung video ngắn gọn, chứa từ khóa SEO.
3. Có lời kêu gọi hành động (CTA) rõ ràng.
4. Sử dụng icon/emoji phù hợp.
5. Thêm 3-5 hashtag (#) liên quan nhất ở cuối.
6. Phải có xuống hàng (line break) rõ ràng giữa các đoạn văn.

BẮT BUỘC TRẢ VỀ CHÍNH XÁC THEO ĐỊNH DẠNG SAU (không giải thích thêm, không dùng markdown code block bao quanh):
[EN]
(Mô tả tiếng Anh)
[VI]
(Mô tả tiếng Việt)
[KW]
(Từ khóa 1, từ khóa 2, từ khóa 3)`;

          try {
            const stream = await ai.models.generateContentStream({
              model: 'gemini-3-flash-preview',
              contents: prompt,
            });

            let buffer = '';
            for await (const chunk of stream) {
              buffer += chunk.text;
              
              let en = '', vi = '', kw = '';
              const enMatch = buffer.match(/\[EN\]([\s\S]*?)(?:\[VI\]|$)/i);
              if (enMatch) en = enMatch[1].trim();

              const viMatch = buffer.match(/\[VI\]([\s\S]*?)(?:\[KW\]|$)/i);
              if (viMatch) vi = viMatch[1].trim();

              const kwMatch = buffer.match(/\[KW\]([\s\S]*?)$/i);
              if (kwMatch) kw = kwMatch[1].trim();

              setResults(prev => {
                const next = [...prev];
                next[actualIndex] = {
                  ...next[actualIndex],
                  descriptionEn: en,
                  descriptionVi: vi,
                  keywords: kw
                };
                return next;
              });
            }
          } catch (err) {
            console.error(`Error generating for title ${title}:`, err);
            setResults(prev => {
              const next = [...prev];
              next[actualIndex] = {
                ...next[actualIndex],
                descriptionEn: 'Lỗi khi tạo mô tả.',
                descriptionVi: 'Lỗi khi tạo mô tả.',
                keywords: 'Lỗi'
              };
              return next;
            });
          } finally {
            // Đánh dấu hoàn thành cho video hiện tại
            setResults(prev => {
              const next = [...prev];
              next[actualIndex] = { ...next[actualIndex], isGenerating: false };
              return next;
            });
          }
        }));
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Đã xảy ra lỗi trong quá trình tạo mô tả. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportExcel = () => {
    if (results.length === 0) return;
    const data = results.map(r => ({
      'Tiêu đề': r.title,
      'Mô tả (English)': r.descriptionEn,
      'Mô tả (Vietnamese)': r.descriptionVi,
      'Từ khóa': r.keywords
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Descriptions");
    XLSX.writeFile(wb, "youtube_seo_descriptions.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-red-900/50 selection:text-red-100">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-xl">
              <Youtube className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-100">
              YT SEO <span className="text-red-500">Describer</span>
            </h1>
          </div>
          <div className="text-sm text-gray-400 font-medium flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Powered by Gemini
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Left Column: Inputs */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-gray-900 rounded-2xl shadow-sm border border-gray-800 p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-100">
                <span className="bg-gray-800 text-gray-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Nhập thông tin video
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="titles" className="block text-sm font-medium text-gray-300 mb-1">
                    Danh sách tiêu đề video <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="titles"
                    rows={6}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 focus:border-red-500 focus:ring-red-500 outline-none transition-shadow resize-none placeholder-gray-500"
                    placeholder="Nhập mỗi tiêu đề trên một dòng...&#10;VD: Hướng dẫn học ReactJS cho người mới bắt đầu&#10;Cách tối ưu SEO YouTube 2024"
                    value={titlesInput}
                    onChange={(e) => setTitlesInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Hệ thống sẽ tự động xử lý 5 tiêu đề mỗi lần.</p>
                </div>

                <div>
                  <label htmlFor="keywords" className="block text-sm font-medium text-gray-300 mb-1">
                    Từ khóa chung (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    id="keywords"
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-100 focus:border-red-500 focus:ring-red-500 outline-none transition-shadow placeholder-gray-500"
                    placeholder="VD: học lập trình, frontend, reactjs"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Nếu để trống, AI sẽ tự động phân tích từ khóa từ tiêu đề.</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !titlesInput.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Tạo Mô Tả
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Tips Card */}
            <div className="bg-blue-950/20 rounded-2xl border border-blue-900/50 p-6">
              <h3 className="text-sm font-semibold text-blue-300 mb-2">Mẹo để có kết quả tốt nhất:</h3>
              <ul className="text-sm text-blue-200/80 space-y-2 list-disc list-inside">
                <li>Viết tiêu đề rõ ràng, chứa từ khóa chính.</li>
                <li>Cung cấp thêm từ khóa ngách ở ô "Từ khóa chung" để AI bám sát chủ đề kênh.</li>
                <li>Kiểm tra lại và có thể tùy chỉnh thêm các link mạng xã hội của riêng bạn vào mô tả.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="xl:col-span-3">
            <div className="bg-gray-900 rounded-2xl shadow-sm border border-gray-800 p-6 min-h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-100">
                  <span className="bg-gray-800 text-gray-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Kết quả Mô tả
                </h2>
                {results.length > 0 && (
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Xuất Excel
                  </button>
                )}
              </div>

              {results.length === 0 && !isGenerating ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 text-center">
                  <Youtube className="w-12 h-12 mb-3 text-gray-700" />
                  <p>Chưa có kết quả nào.<br/>Hãy nhập tiêu đề và nhấn "Tạo Mô Tả" để bắt đầu.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {results.map((result, index) => (
                    <div key={index} className="border border-gray-800 rounded-xl overflow-hidden group flex flex-col bg-gray-950">
                      <div className="bg-gray-800/50 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                        <span className="bg-red-900/30 text-red-400 text-xs font-bold px-2 py-1 rounded-md shrink-0">
                          #{index + 1}
                        </span>
                        <h3 className="font-medium text-gray-100 truncate flex-1" title={result.title}>
                          {result.title}
                        </h3>
                        {result.isGenerating && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 px-2 py-1 rounded-md border border-red-900/50">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang viết...
                          </div>
                        )}
                        {result.isPending && (
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-md">Đang chờ...</span>
                        )}
                      </div>
                      
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
                        {/* English Version */}
                        <div className="flex flex-col">
                          <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
                            <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">🇺🇸 English (Default)</span>
                            <button
                              onClick={() => handleCopy(result.descriptionEn, `${index}-en`)}
                              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-100 bg-gray-800 border border-gray-700 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {copiedIndex === `${index}-en` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                  <span className="text-green-500">Đã copy</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="p-4 bg-gray-900 max-h-80 overflow-y-auto flex-1">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                              {result.descriptionEn}
                            </pre>
                          </div>
                        </div>

                        {/* Vietnamese Version */}
                        <div className="flex flex-col">
                          <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800">
                            <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">🇻🇳 Vietnamese</span>
                            <button
                              onClick={() => handleCopy(result.descriptionVi, `${index}-vi`)}
                              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-100 bg-gray-800 border border-gray-700 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {copiedIndex === `${index}-vi` ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                  <span className="text-green-500">Đã copy</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="p-4 bg-gray-900 max-h-80 overflow-y-auto flex-1">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                              {result.descriptionVi}
                            </pre>
                          </div>
                        </div>
                      </div>

                      {/* Keywords */}
                      <div className="bg-gray-800/30 p-3 border-t border-gray-800 text-xs text-gray-400">
                        <span className="font-semibold text-gray-300">Từ khóa: </span>
                        {result.keywords}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
