import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Loader2, Sparkles, ImageIcon, Grid, AlertCircle, FileText } from './components/Icons';
import { AppState, SlicedImage, MarketingAsset } from './types';
import { generateMemeImage, generateBanner, generateLogo, generateMemeMetadata, ensureApiKey } from './services/geminiService';
import { fileToBase64, sliceMemeGrid, processImage, downloadBatch } from './services/imageUtils';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<AppState>(AppState.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [slicedImages, setSlicedImages] = useState<SlicedImage[]>([]);
  const [banner, setBanner] = useState<MarketingAsset | null>(null);
  const [logo, setLogo] = useState<MarketingAsset | null>(null);
  const [metaData, setMetaData] = useState<{title: string, description: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRefImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setRefImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg("请输入提示词来描述您的表情包。");
      return;
    }

    try {
      setErrorMsg(null);
      setStatus(AppState.GENERATING);
      setStatusMessage("正在初始化...");

      // 1. Ensure API Key
      await ensureApiKey();

      // 2. Prepare Reference Image
      let refBase64: string | undefined = undefined;
      let refMime: string | undefined = undefined;

      if (refImage) {
        refBase64 = await fileToBase64(refImage);
        refMime = refImage.type;
      }

      const params = {
        userPrompt: prompt,
        referenceImageBase64: refBase64,
        referenceImageMimeType: refMime
      };

      // 3. Parallel Generation: Meme Grid, Banner, Logo, Metadata
      setStatusMessage("正在生成表情包、横幅、Logo 和文案...");
      
      const [memeBase64, bannerBase64, logoBase64, meta] = await Promise.all([
        generateMemeImage(params),
        generateBanner(params),
        generateLogo(params),
        generateMemeMetadata(params)
      ]);

      setOriginalImage(memeBase64);
      setMetaData(meta);
      
      // 4. Processing Assets
      setStatus(AppState.PROCESSING);
      setStatusMessage("正在切片和压缩图片...");

      // Process Meme Grid
      const slices = await sliceMemeGrid(memeBase64);
      setSlicedImages(slices);

      // Process Banner (750x400) - PNG
      const bannerAsset = await processImage(bannerBase64, 750, 400, 'banner.png');
      setBanner(bannerAsset);

      // Process Logo (Resize to standard 512x512 for quality, compressed) - PNG
      const logoAsset = await processImage(logoBase64, 512, 512, 'logo.png');
      setLogo(logoAsset);
      
      setStatus(AppState.COMPLETE);
      setStatusMessage("");

    } catch (err: any) {
      console.error(err);
      setStatus(AppState.ERROR);
      setErrorMsg(err.message || "生成过程中发生意外错误。");
    }
  };

  const reset = () => {
    setStatus(AppState.IDLE);
    setOriginalImage(null);
    setSlicedImages([]);
    setBanner(null);
    setLogo(null);
    setMetaData(null);
    setErrorMsg(null);
  };

  const handleDownloadAll = () => {
    const assets: MarketingAsset[] = [];
    if (banner) assets.push(banner);
    if (logo) assets.push(logo);
    downloadBatch(slicedImages, assets, metaData || undefined);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Grid className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">表情包工坊</h1>
            <p className="text-slate-400 text-sm">AI 驱动的全套表情包生成工具</p>
          </div>
        </div>
        {status === AppState.COMPLETE && (
           <button 
             onClick={reset}
             className="text-sm text-slate-400 hover:text-white transition-colors"
           >
             重新开始
           </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT PANEL: Controls */}
        <section className="lg:col-span-4 space-y-6">
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            
            {/* Reference Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                参考图 (可选)
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer group relative border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 rounded-xl p-4 transition-all duration-300 flex flex-col items-center justify-center min-h-[160px]"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*"
                />
                
                {refImagePreview ? (
                  <div className="relative w-full h-full flex justify-center">
                    <img src={refImagePreview} alt="Reference" className="max-h-48 rounded-lg shadow-md object-contain" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <span className="text-white text-sm font-medium">更换图片</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-slate-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                       <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
                    </div>
                    <p className="text-sm text-slate-400 text-center">
                      点击上传参考图<br/>
                      <span className="text-xs text-slate-500">(人物、风格等)</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                提示词描述
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：一只可爱的猫面对工作时的各种反应，滑稽的表情，夸张的情绪..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32 transition-all"
              />
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={status === AppState.GENERATING || status === AppState.PROCESSING}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 ${
                status === AppState.GENERATING || status === AppState.PROCESSING
                  ? 'bg-indigo-900/50 text-indigo-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25'
              }`}
            >
              {status === AppState.GENERATING || status === AppState.PROCESSING ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {statusMessage || "正在处理..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  生成全套素材
                </>
              )}
            </button>
            
            {(status === AppState.GENERATING || status === AppState.PROCESSING) && (
              <p className="mt-4 text-xs text-center text-slate-500 animate-pulse">
                正在使用 Gemini Pro 生成 4K 表情包 + Banner + Logo 及文案，请耐心等待...
              </p>
            )}

            {errorMsg && (
              <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-start gap-3 text-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="p-5 bg-slate-900/30 border border-slate-800/50 rounded-xl text-sm text-slate-400">
            <h3 className="text-slate-300 font-semibold mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> 输出内容
            </h3>
            <ul className="list-disc pl-4 space-y-1">
              <li>AI 自动生成的标题与简介</li>
              <li>4K 表情包网格 (24 张小图)</li>
              <li>网站横幅 Banner (750x400)</li>
              <li>应用图标 Logo (1:1, 压缩版)</li>
            </ul>
          </div>
        </section>

        {/* RIGHT PANEL: Results */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* Default Empty State */}
          {status === AppState.IDLE && !originalImage && (
            <div className="h-full min-h-[500px] border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
              <div className="p-4 bg-slate-900 rounded-full mb-4">
                <Grid className="w-12 h-12 text-slate-700" />
              </div>
              <p className="text-lg font-medium">生成的素材将显示在这里</p>
            </div>
          )}

          {/* Results Area */}
          {(originalImage || slicedImages.length > 0) && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header for Results */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">生成结果</h2>
                  {slicedImages.length > 0 && (
                    <button
                      onClick={handleDownloadAll}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
                    >
                      <Download className="w-4 h-4" />
                      批量下载 Zip ({slicedImages.length + (banner ? 1 : 0) + (logo ? 1 : 0) + (metaData ? 1 : 0)})
                    </button>
                  )}
                </div>
                
                {/* Metadata Card */}
                {metaData && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-3 opacity-10">
                       <FileText className="w-20 h-20" />
                     </div>
                     <h3 className="text-lg font-bold text-indigo-400 mb-2">{metaData.title}</h3>
                     <p className="text-slate-300 leading-relaxed text-sm">{metaData.description}</p>
                     <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                       <FileText className="w-3 h-3"/> 已包含在下载包的 info.txt 中
                     </div>
                  </div>
                )}

                {/* Marketing Assets Row */}
                {(banner || logo) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {banner && (
                      <div className="space-y-2">
                         <div className="flex justify-between items-center text-slate-400 text-sm">
                           <h3>横幅 Banner (750x400)</h3>
                           <a href={banner.dataUrl} download={banner.fileName} className="hover:text-white flex items-center gap-1"><Download className="w-3 h-3"/>下载</a>
                         </div>
                         <div className="rounded-xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900">
                           <img src={banner.dataUrl} alt="Banner" className="w-full h-auto" />
                         </div>
                      </div>
                    )}
                    {logo && (
                      <div className="space-y-2">
                         <div className="flex justify-between items-center text-slate-400 text-sm">
                           <h3>Logo 图标 (1:1)</h3>
                           <a href={logo.dataUrl} download={logo.fileName} className="hover:text-white flex items-center gap-1"><Download className="w-3 h-3"/>下载</a>
                         </div>
                         <div className="rounded-xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900 flex justify-center">
                           <img src={logo.dataUrl} alt="Logo" className="h-48 w-48 object-cover" />
                         </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-800/50 my-6"></div>

                {/* Grid View of Sliced Images */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-400">表情包切片预览</h3>
                  {slicedImages.length > 0 && (
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                       {slicedImages.map((slice) => (
                         <div key={slice.id} className="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors">
                           <img 
                             src={slice.dataUrl} 
                             alt="Meme Slice" 
                             className="w-full h-full object-cover"
                           />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <a 
                               href={slice.dataUrl} 
                               download={slice.fileName}
                               className="p-2 bg-white rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors"
                               title="下载单张"
                             >
                               <Download className="w-4 h-4" />
                             </a>
                           </div>
                         </div>
                       ))}
                     </div>
                  )}
                </div>

                {/* Original Full Image Preview */}
                <div className="space-y-2 mt-8">
                  <h3 className="text-sm font-medium text-slate-400">表情包原始全图 (4K)</h3>
                  <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                    <img 
                      src={`data:image/png;base64,${originalImage}`} 
                      alt="Full Generated Grid" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>

             </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default App;