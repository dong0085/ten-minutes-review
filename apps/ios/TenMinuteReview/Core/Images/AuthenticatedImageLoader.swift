import UIKit

final class AuthenticatedImageLoader {
    private let api: APIClient
    private let cache = NSCache<NSURL, UIImage>()

    init(api: APIClient) {
        self.api = api
    }

    func image(for urlString: String) async -> UIImage? {
        guard let url = resolve(urlString) else { return nil }
        if let cached = cache.object(forKey: url as NSURL) {
            return cached
        }
        guard let data = try? await api.rawData(at: url) else { return nil }
        guard let image = UIImage(data: data) else { return nil }
        cache.setObject(image, forKey: url as NSURL)
        return image
    }

    /// Upload URLs are either absolute (blob storage) or relative to the API
    /// origin (`/api/files/...`).
    func resolve(_ urlString: String) -> URL? {
        if let url = URL(string: urlString), url.scheme != nil {
            return url
        }
        return URL(string: urlString, relativeTo: api.baseURL)?.absoluteURL
    }
}
