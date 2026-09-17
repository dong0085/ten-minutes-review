import XCTest
@testable import TenMinuteReview

final class OptionOrderTests: XCTestCase {
    func testShuffleProducesAPermutation() {
        for count in 0...12 {
            let order = shuffledIndexOrder(count: count)
            XCTAssertEqual(order.count, count)
            XCTAssertEqual(Set(order), Set(0..<count))
        }
    }

    func testNeverRepeatsPreviousOrder() {
        let previous = [0, 1, 2, 3]
        for _ in 0..<200 {
            let next = shuffledIndexOrder(count: 4, previous: previous)
            XCTAssertNotEqual(next, previous)
        }
    }

    func testIdenticalShuffleRotatesByOne() {
        // A random source pinned to 1.0 never swaps, producing the identity
        // order; the don't-repeat rule then rotates it by one.
        let order = shuffledIndexOrder(count: 4, previous: [0, 1, 2, 3], random: { 1.0 })
        XCTAssertEqual(order, [1, 2, 3, 0])
    }

    func testIsIndexOrderValidation() {
        XCTAssertTrue(isIndexOrder([0, 1, 2], count: 3))
        XCTAssertTrue(isIndexOrder([2, 0, 1], count: 3))
        XCTAssertFalse(isIndexOrder([0, 0, 1], count: 3), "duplicates are rejected")
        XCTAssertFalse(isIndexOrder([0, 1], count: 3), "wrong length is rejected")
        XCTAssertFalse(isIndexOrder([0, 1, 3], count: 3), "out of range is rejected")
        XCTAssertFalse(isIndexOrder(nil, count: 3))
    }
}
