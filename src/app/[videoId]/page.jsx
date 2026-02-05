import VideoViewPage from '../components/VideoViewPage';

export default async function VideoPage({ params }) {
  const { videoId } = await params;
  return <VideoViewPage videoId={videoId} />;
}

