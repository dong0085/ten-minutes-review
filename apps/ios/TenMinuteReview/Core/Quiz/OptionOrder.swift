/// Display order for multiple-choice options, ported from
/// `shuffledIndexOrder` in packages/core/src/option-order.ts so both clients
/// shuffle identically and never repeat the previous order.
func isIndexOrder(_ order: [Int]?, count: Int) -> Bool {
    guard let order, order.count == count else { return false }
    guard Set(order).count == count else { return false }
    return order.allSatisfy { $0 >= 0 && $0 < count }
}

func shuffledIndexOrder(
    count: Int,
    previous: [Int]? = nil,
    random: () -> Double = { Double.random(in: 0..<1) }
) -> [Int] {
    var order = Array(0..<count)
    for index in stride(from: count - 1, to: 0, by: -1) {
        let swapIndex = Int(random() * Double(index + 1))
        order.swapAt(index, min(swapIndex, index))
    }

    if count > 1,
       isIndexOrder(previous, count: count),
       order == previous {
        order.append(order.removeFirst())
    }

    return order
}
