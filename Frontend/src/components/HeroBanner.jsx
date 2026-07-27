const HeroBanner = () => {
  const handleShopNow = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative bg-gradient-to-r from-teal-700 via-teal-600 to-teal-500 rounded-3xl overflow-hidden shadow-xl mb-10 border border-teal-500/20">
      
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_30%_20%,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" aria-hidden="true"></div>
      
      <div className="relative flex flex-col md:flex-row items-center justify-between p-8 md:p-14 gap-8">
        
        {/* Left Side: Text and Button */}
        <div className="text-white space-y-5 md:w-3/5 z-10 text-center md:text-left">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
              Mega Sale Active 🔥
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight drop-shadow-sm">
            Upgrade Your <span className="text-teal-200">Tech</span> & <span className="text-orange-200">Lifestyle</span>
          </h1>
          <p className="text-teal-100 text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Get up to <span className="font-bold text-white text-lg">50% off</span> on top electronics, premium accessories, and home essentials. Limited time offer!
          </p>
          <button 
            onClick={handleShopNow}
            className="mt-6 bg-white text-teal-700 font-extrabold py-3.5 px-9 rounded-xl shadow-lg hover:bg-teal-50 hover:text-teal-800 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 active:translate-y-0 cursor-pointer"
            aria-label="Shop now and browse products"
          >
            Shop Now ⚡
          </button>
        </div>
 
        {/* Right Side: Image with Floating Animation */}
        <div className="mt-6 md:mt-0 md:w-2/5 flex justify-center z-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-300 to-teal-100 rounded-2xl blur-xl opacity-30 group-hover:opacity-40 transition-opacity duration-300"></div>
            <img 
              src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop" 
              alt="Shopping Sale" 
              loading="eager"
              className="relative rounded-2xl shadow-2xl object-cover h-60 w-80 md:h-72 md:w-96 border-4 border-white/20 hover:scale-[1.02] transition-transform duration-500 ease-out"
            />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default HeroBanner;