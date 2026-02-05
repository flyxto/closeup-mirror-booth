/** @format */

export default function TikTokLoader() {
  return (
    <div className="flex items-center justify-center ">
      <div className="relative w-44 h-44">
        {/* Magenta circle */}
        <div className="absolute inset-0 z-30 w-full h-full">
          <svg
            fill="#0A70B8"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="1" y="6" width="2.8" height="12">
              <animate
                begin="spinner_Diec.begin+0.4s"
                attributeName="y"
                calcMode="spline"
                dur="0.6s"
                values="6;1;6"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
              <animate
                begin="spinner_Diec.begin+0.4s"
                attributeName="height"
                calcMode="spline"
                dur="0.6s"
                values="12;22;12"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
            </rect>
            <rect x="5.8" y="6" width="2.8" height="12">
              <animate
                begin="spinner_Diec.begin+0.2s"
                attributeName="y"
                calcMode="spline"
                dur="0.6s"
                values="6;1;6"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
              <animate
                begin="spinner_Diec.begin+0.2s"
                attributeName="height"
                calcMode="spline"
                dur="0.6s"
                values="12;22;12"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
            </rect>
            <rect x="10.6" y="6" width="2.8" height="12">
              <animate
                id="spinner_Diec"
                begin="0;spinner_dm8s.end-0.1s"
                attributeName="y"
                calcMode="spline"
                dur="0.6s"
                values="6;1;6"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
              <animate
                begin="0;spinner_dm8s.end-0.1s"
                attributeName="height"
                calcMode="spline"
                dur="0.6s"
                values="12;22;12"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
            </rect>
            <rect x="15.4" y="6" width="2.8" height="12">
              <animate
                begin="spinner_Diec.begin+0.2s"
                attributeName="y"
                calcMode="spline"
                dur="0.6s"
                values="6;1;6"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
              <animate
                begin="spinner_Diec.begin+0.2s"
                attributeName="height"
                calcMode="spline"
                dur="0.6s"
                values="12;22;12"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
            </rect>
            <rect x="20.2" y="6" width="2.8" height="12">
              <animate
                id="spinner_dm8s"
                begin="spinner_Diec.begin+0.4s"
                attributeName="y"
                calcMode="spline"
                dur="0.6s"
                values="6;1;6"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
              <animate
                begin="spinner_Diec.begin+0.4s"
                attributeName="height"
                calcMode="spline"
                dur="0.6s"
                values="12;22;12"
                keySplines=".14,.73,.34,1;.65,.26,.82,.45"
              />
            </rect>
          </svg>
        </div>

        <style jsx>{`
          @keyframes orbit1 {
            0%,
            100% {
              transform: translate(-50%, -50%) translateX(-40px);
            }
            50% {
              transform: translate(-50%, -50%) translateX(40px);
            }
          }

          @keyframes orbit2 {
            0%,
            100% {
              transform: translate(-50%, -50%) translateX(40px);
            }
            50% {
              transform: translate(-50%, -50%) translateX(-40px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
