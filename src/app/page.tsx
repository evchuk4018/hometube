import { HomeClient } from "./home-client";
import { getDownloadsData, getHomeData } from "@/server/services/read-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, downloads] = await Promise.all([getHomeData(), getDownloadsData()]);
  return <HomeClient initialVideos={data.videos} initialDownloads={downloads} generatedAt={data.generatedAt} />;
}
