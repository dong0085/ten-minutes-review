import SwiftUI

struct RemoteImage: View {
    let urlString: String

    @Environment(AppEnvironment.self) private var environment
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                Rectangle()
                    .fill(.quaternary)
                    .overlay {
                        Image(systemName: "photo")
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .task(id: urlString) {
            image = await environment.images.image(for: urlString)
        }
    }
}
